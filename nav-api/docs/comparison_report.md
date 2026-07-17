# sitenav 迁移计划与 nav-api 项目对比及技术选型报告

本报告将 Python 版本中 `sitenav` 的功能迁移计划与本地已有的 Cloudflare Workers 后端项目 `cf-nav/nav-api` 进行深度对比分析。旨在帮助我们理清异同、制定数据兼容策略，并为在 `nav-api2` 中落实最终实现提供高可行的技术指引。

---

## 1. 架构定位与技术栈对比

| 维度 | Python (FastAPI) `sitenav` | 已有项目 `cf-nav/nav-api` | 迁移后 `nav-api2` 建议 |
| :--- | :--- | :--- | :--- |
| **底层平台** | 本地 Python 运行环境 | **Cloudflare Workers (TypeScript)** | **Cloudflare Workers (TypeScript)** |
| **Web 路由** | FastAPI (带交互式 Swagger Docs) | **OpenAPI Hono** (`@hono/zod-openapi`) | **OpenAPI Hono** (`@hono/zod-openapi`) |
| **安全/鉴权** | 简易 Log (无鉴权) | 支持 **CORS 跨域** 与 **API-Key 鉴权** 中间件 | 继承 `nav-api` 的安全鉴权体系 |
| **数据访问** | `aiosqlite` 异步原生 SQL | **Drizzle ORM** (对象关系映射框架) | **Drizzle ORM** + **Cloudflare D1** |
| **接口自文档**| 自动生成 OpenAPI 规范 | 基于 Zod 模式在代码层定义强类型 OpenAPI 接口，自动渲染 Swagger UI (`/docs`) | 沿用强类型 OpenAPI 定义，保持规范化文档 |

---

## 2. 数据库设计差异与数据映射 (关键差异点)

这是两个项目最核心的重构差异点：

### Python 版本 (单表树形结构)
原 Python 版采用单表 `site_item` 表达所有的节点（分类和网址属于同一张表），通过 `pId = 0` 表示根分类，通过 `pId = <id>` 建立无限层级关系。
- 缺点：分类与具体网址的属性混在一起，当某个节点是网址时，其 `isExpand` 没有意义；当节点是分类时，其 `uri` 字段又必须为 NULL。

### `nav-api` 版本 (关系型双表结构)
`nav-api` 进行了合理的表结构解耦，拆分为 `categories` 与 `sites` 两张表：
1. **`categories`**（分类表）：包含 `id`, `pid` (父分类ID), `name`, `sortOrder`, `isExpand`。用于构建无限层级的分类目录树。
2. **`sites`**（站点表）：包含 `id`, `categoryId` (指向对应的分类), `name`, `url`, `description`, `icon`, `sortOrder` 等。站点自己不带 `pid`，它必须隶属于某个分类。

### 字段映射关系对照表
如果迁移时沿用双表结构，字段将按以下映射方式流转：

| 原 Python (`site_item` 表) | 双表方案目标表 | 目标表字段 | 转换说明 |
| :--- | :--- | :--- | :--- |
| `id` | `categories` 或 `sites` | `id` | 主键保留 |
| `pId` | `categories` | `pid` | 分类之间的上下级父子关系 |
| - | `sites` | `categoryId` | 网址节点需关联其所属分类的 ID |
| `name` | 两表均有 | `name` | 对应名称 |
| `desc` | `sites` | `description` | 对应描述（分类表无此字段） |
| `uri` | `sites` | `url` | 网址 |
| `isExpand` | `categories` | `isExpand` | 分类是否默认展开（布尔值映射） |
| `favicon` | `sites` | `icon` | 站点图标链接 |
| `status` | 两表均有 | `status` | 状态码 |
| `category` | 两表均无 | - | `index` 或 `other` 可通过挂载不同的根级分类来划分，不再需要这个纯文本字段 |
| `orderNum` | 两表均有 | `sortOrder` | 排序权重 |

---

## 3. 接口实现差异与补全计划

我们对 Python 原有接口与 `nav-api` 中已实现的接口进行功能对齐，并指出在 `nav-api2` 中需要补全的开发任务：

### ① 数据检索类接口
- **获取扁平站点列表 (`GET /sites`)**：
  - *Python*：返回 `site_item` 列表。
  - *nav-api*：已实现 `GET /api/sites`，基于 Drizzle 查询并返回强类型的站点数组。
- **获取树形站点结构 (`GET /sites/tree`)**：
  - *Python*：在内存中根据 `pId` 组装树形。
  - *nav-api*：已在 `src/routes/sites.ts` 中实现 `GET /api/sites/tree`。该逻辑能自动查出所有 `categories` 和 `sites`，通过 Map 在内存中构建多级目录并挂载站点节点的嵌套结构。**完全满足需求，无需重写**。

### ② 数据修改类接口 (CRUD)
- **保存站点 (`POST /sites`)** / **删除站点 (`DELETE /sites/:id`)**：
  - *Python*：支持无 ID 时插入、有 ID 时更新。若传入 uri 且 desc 为空，在插入前**触发元数据爬取**；删除时递归级联删除所有子孙节点。
  - *nav-api*：已实现常规的 `POST` (Create)、`PUT` (Update)、`DELETE` (Delete) 接口。
  - *nav-api2 补全*：
    - 需要在 `POST /api/sites` 写入数据库前，判断是否包含 URL 且 description 为空。如果是，则调用元数据抓取逻辑进行补全。
    - 需要在删除分类接口上实现级联删除，即在 Drizzle 中同步删除其下的所有子分类和站点。

### ③ 缺失的功能接口 (在 `nav-api2` 中待实现)
1. **生成前端 `.js` 文件 (`GET /sites/generate`)**：
   - *实现方式*：在 Hono 中创建该路由。利用与 `GET /sites/tree` 相同的逻辑从 D1 提取树形数据，然后将其格式化为标准的 JavaScript 文本（形如 `const index_site_list = [...]`）。最后，通过 Hono 响应流返回，并指定 Header `Content-Type: application/javascript; charset=utf-8`。
2. **实时爬取元数据 (`GET /sites/fetch_metadata`)**：
   - *实现方式*：创建独立的抓取端点。在 Workers 中通过 `fetch` 请求目标 URL，并使用边缘原生的 **`HTMLRewriter`** 流式提取网页的 Title、Description 和 Icon Link。
3. **批量更新元数据 (`POST /sites/update_metadata_batch`)**：
   - *实现方式*：筛选出 D1 数据库中所有 `icon` 字段为空或为空字符串的站点，并发或排队发起 `fetch` 进行元数据提取，并将提取出来的图标和描述信息批量 `UPDATE` 回 D1。

---

## 4. 数据导入与迁移兼容性方案

原 Python 目录中提供的历史数据备份文件 `sqlite_index.sql` 和 `sqlite_other.sql` 是针对单表 `site_item` 编写的，**无法直接执行导入**到新版 `categories` 和 `sites` 双表中。

在 `nav-api2` 中，我们建议使用以下两种数据迁移方案之一：

### 方案 A：编写自动化数据清洗与迁移脚本 (推荐)
在 `nav-api2` 项目的 `scripts` 目录下编写一个 Node.js 迁移脚本：
1. 脚本读取原 `sqlite_index.sql` 和 `sqlite_other.sql` 的内容，利用正则表达式解析出所有插入字段。
2. 依据 `uri` 字段是否为空进行分类归档：
   - `uri` 为空（或为 `NULL`/`javascript:void(0);`）的节点，将其转换为 `categories` 数据（记录原 ID 与 PID）。
   - `uri` 不为空的节点，转换为 `sites` 数据，其 `categoryId` 指向它的父级 ID（即原 `pId`）。
3. 使用 Drizzle ORM 直接批量 `insert` 到 Cloudflare D1 本地/远程数据库。
- **优点**：一次编写，全自动迁移，无需手动编辑成千上万行 SQL。

### 方案 B：手动将单表结构移植至新 D1 (退回单表模式)
如果我们不希望破坏原 SQL 文件的物理结构，可以直接修改 `nav-api` 的 Drizzle Schema，删掉 `categories` 和 `sites`，改回原来的单张 `site_item` 表。
- **优点**：原 SQL 文件能 100% 导入，无需修改任何历史 SQL。
- **缺点**：丧失了现代关系型数据库的设计优势，代码和字段设计将回归冗余，降低了 TypeScript 下的类型表达精确度。

---

## 5. 迁移决策建议

> [!IMPORTANT]
> **技术决策推荐：基于 `nav-api` 现有的「双表结构 + Drizzle ORM + Hono OpenAPI」体系进行功能补全与升级。**
> 
> **理由**：
> 1. `nav-api` 已经建立起了一套非常规范的 TypeScript 项目骨架，使用 OpenAPI-Zod 可以让我们非常安全地约束接口输入输出，避免了原 Python 后端松散的参数传递问题。
> 2. `Drizzle ORM` 提供了开箱即用的类型推断和数据迁移（Migrations）工具，比手写 SQL 具有更高的可维护性。
> 3. 双表设计在长远看有利于分类导航与网址数据的独立拓展和维护。
> 
> **下一步在 `nav-api2` 中的具体编码动作**：
> - 复制 `nav-api` 项目骨架为 `nav-api2`。
> - 在 `src/routes/sites.ts` 中整合 `HTMLRewriter` 爬虫逻辑。
> - 补齐 `GET /sites/generate` (输出 JS 文件流) 接口。
> - 补齐 `POST /sites/update_metadata_batch` 批量元数据抓取接口。
> - 编写数据迁移脚本，把 `sqlite_index.sql` 和 `sqlite_other.sql` 一键灌入 D1。

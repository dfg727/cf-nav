# 迁移任务清单 (v1/v2 物理双表隔离方案)

本任务清单根据最新的多版本兼容迁移计划整理，指导从 Python `sitenav` 迁移至 `cf-nav/nav-api2` 项目（基于 Hono + Drizzle ORM + D1）的完整实现。

---

## 阶段一：项目初始化与数据库架构（D1 & Drizzle）

- [ ] **1.1 项目骨架与 Drizzle 配置**
  - [ ] 复制或基于已有的 `cf-nav/nav-api` 作为底层骨架。
  - [ ] 检查并规范 `package.json` 中的依赖，确保包含 `hono`、`@hono/zod-openapi`、`drizzle-orm`、`drizzle-kit` 等。
- [ ] **1.2 物理数据库表结构与索引设计**
  - [ ] 在 `src/db/schema.ts` 中声明 `categories` 和 `sites` 双表结构。
  - [ ] **Schema 索引声明**：在 Drizzle Schema 中显式声明以下 4 个高频/过滤索引，避免下一次 `generate` 出现冲突：
    - [ ] `idx_categories_pid` 覆盖 `categories(pid)`
    - [ ] `idx_sites_category_id` 覆盖 `sites(category_id)`
    - [ ] `idx_sites_public_status_sort` 覆盖 `sites(is_public, status, sort_order)`
    - [ ] `idx_categories_public_status_sort` 覆盖 `categories(is_public, status, sort_order)`
  - [ ] 运行 `npx drizzle-kit generate` 生成对应的本地 D1 迁移 SQL 文件。
- [ ] **1.3 D1 数据库创建与本地初始化**
  - [ ] 创建 D1 数据库实例 `nav-app-db`。
  - [ ] 运行 Drizzle 迁移命令将表结构应用到本地开发数据库（`wrangler d1 migrations apply`）。

---

## 阶段二：数据清洗迁移与对账（一键导入脚本）

- [ ] **2.1 编写 `migrate-legacy.ts` 迁移框架**
  - [ ] 在 `scripts/migrate-legacy.ts` 中解析原 Python 目录下的 `sqlite_index.sql` 和 `sqlite_other.sql` 中的 INSERT 语句。
  - [ ] 建立数据判定器：
    - [ ] 分类判定器：`uri IS NULL`
    - [ ] 死链占位符过滤：过滤 `name` 为空且 `uri` 属于 `javascript:void(0);` 或 `javascript:;` 的 6 行死链行，并记录至迁移报告 `skipped` 数组。
- [ ] **2.2 实现站点物理自增起点控制**
  - [ ] 实现 `seedSiteAutoIncrementFloor` 函数：在插入任何真实数据前，显式插入并立刻删除一条 `id = 9999999` 的占位站点，确保 `sites` 物理主键从 `10000000` 开始递增。
- [ ] **2.3 两阶段导入与 ID 内存映射算法**
  - [ ] **阶段一：分类物理写入**：逐个插入分类行，其 `pid` 暂时填空。并在内存 Map `oldToNewCategoryId` 中记录 `旧 ID -> 新 categories.id` 的映射。
  - [ ] **阶段二 A：分类 pid 映射回填**：遍历分类，将原 `pId` 通过映射表转换为新的父分类 ID 并 `UPDATE` 写入数据库。对映射缺失的**悬空引用直接抛出 Error** 中断迁移。
  - [ ] **阶段二 B：站点物理写入**：遍历站点，通过映射表将原 `pId` 转换为新 `categoryId` 并 `INSERT` 写入数据库。映射缺失时抛错。
- [ ] **2.4 编写迁移后 SQL 对账校验逻辑**
  - [ ] 在迁移脚本末尾，执行四项 SQL 级别的数据完整性校验：
    - [ ] 校验 1：检测无悬空的 `sites.category_id` (期望结果：0)。
    - [ ] 校验 2：检测无悬空的 `categories.pid` (期望结果：0)。
    - [ ] 校验 3：使用递归 CTE 校验无自循环引用或闭环路径。
    - [ ] 校验 4：总行数对账：`新分类行数 + 新站点行数 = 原 SQL 行数 - 死链过滤行数`。

---

## 阶段三：安全防御与鉴权基线

- [ ] **3.1 API-Key 全方法鉴权与密钥管理**
  - [ ] 修改全局 `authMiddleware`：**去掉对 `GET` 方法的鉴权豁免**，实现全方法鉴权，校验失败一律返回 `401 Unauthorized`。
  - [ ] 配置安全密钥：生产部署时，使用 `wrangler secret put API_KEY` 写入加密 Secret，不再于 `wrangler.toml` 的 `[vars]` 中明文写出。
- [ ] **3.2 v1 接口 ID 解码与告警器开发**
  - [ ] 编写 `src/adapters/v1IdCodec.ts`：
    - [ ] 实现 `decodeV1Id()`：根据 `10000000` 阈值直接判定落入 `site` 还是 `category`，统一收敛判断入口。
    - [ ] 实现 `assertCategoryIdHeadroom()`：在分类写入（或迁移脚本）后读取 `sqlite_sequence`，一旦 categories 自增序列突破 `8,000,000` 安全线，立刻抛错并触发预警。

---

## 阶段四：v1 接口兼容层实现 (`/api/v1/*`)

- [ ] **4.1 编写 v1 数据转换适配层 (Adapter)**
  - [ ] 编写 `mapCategoryToV1` 和 `mapSiteToV1` 转换函数。
  - [ ] **权限与状态过滤**：在拼表和映射前对请求方是否为 Admin 进行判定（依据 api-key 头）。非 Admin 情况下，仅拉取 `is_public = 1 AND status = 1` 的分类和站点。
- [ ] **4.2 实现 v1 只读接口与动态 JS 生成**
  - [ ] 实现 `GET /api/v1/sites`：联查双表并转换为 v1 扁平格式。
  - [ ] 实现 `GET /api/v1/sites/tree`：利用适配后的扁平数据，在内存中还原 `pId` 并组装嵌套树形。
  - [ ] **实现 `GET /api/v1/sites/generate` (方案 A)**：
    - [ ] 基于适配后的树形数据，使用 **`JSON.stringify()`** 安全地序列化数据（防范引号逃逸和脚本注入）。
    - [ ] 设置 `Content-Type: application/javascript; charset=utf-8` 与 `X-Content-Type-Options: nosniff` 头动态返回。
- [ ] **4.3 实现 v1 写操作与元数据爬虫**
  - [ ] 实现 `DELETE /api/v1/sites/:id`：利用 `decodeV1Id` 分流。若为分类，调用广度优先遍历级联删除子孙分类与站点；若为站点则直接物理删除。
  - [ ] 实现 `POST /api/v1/sites`：解析入参，根据 ID 范围自动识别目标表并剥离偏移。
  - [ ] **实现带有 SSRF 防御的元数据爬虫** (`GET /api/v1/sites/fetch_metadata`)：
    - [ ] 校验输入的 URL Scheme（仅允许 `http`/`https`）。
    - [ ] DNS 解析主机名（或借用 CF DoH），过滤 RFC1918 私网 IP 及云厂商元数据网段。对于重定向地址执行二次校验。
    - [ ] 利用 `AbortSignal.timeout(10000)` 限制 10s 超时，限制响应体流式提取最大为 1MB。
    - [ ] 使用 CF 内置高性能 `HTMLRewriter` 解析得到 title、description、favicon 并补全相对路径。
- [ ] **4.4 实现批量元数据同步**
  - [ ] 实现 `POST /api/v1/sites/update_metadata_batch`：
    - [ ] 筛选 D1 中所有 icon 为空且 uri 有效的站点。
    - [ ] 引入分批并发机制（如每批 5～10 个并发）限制外部请求频次。
    - [ ] 设定单次请求处理上限（如 50 个），超出时返回分页续传游标。

---

## 阶段五：v2 接口标准层实现 (`/api/v2/*`)

- [ ] **5.1 编写标准分类 (Categories) CRUD 接口**
  - [ ] `GET /api/v2/categories`：支持只读可见性过滤及为后续扩容预留分页参数占位。
  - [ ] `POST` / `PUT` `/api/v2/categories` 接口实现。
  - [ ] **`DELETE /api/v2/categories/:id` 级联删除机制**：默认 `cascade=false` 时，若分类下有内容则返回 `409 Conflict`；仅当显式传入 `?cascade=true` 时调用级联删除。
- [ ] **5.2 编写标准站点 (Sites) CRUD 接口**
  - [ ] `GET /api/v2/sites`：支持按分类过滤、可见性过滤。
  - [ ] `POST` / `PUT` `/api/v2/sites` 接口实现（集成爬虫补全逻辑）。
  - [ ] `DELETE /api/v2/sites/:id` 物理删除接口。
  - [ ] `GET /api/v2/sites/tree` 接口实现：输出标准双表嵌套树（无 ID 偏移）。

---

## 阶段六：本地联调、自动对比与生产切换

- [ ] **6.1 本地回归联调与自动对比**
  - [ ] 编写简单的对比脚本，同时运行老 Python API 服务与本地 Worker API 服务，对其 `sites` 扁平与 `sites/tree` (覆盖 index/other 分类) 的 JSON 响应进行字段级 diff 校验，确保无差异。
- [ ] **6.2 云端迁移与灰度发布**
  - [ ] 导出云端生产库备份 SQL。
  - [ ] 执行 `migrate-legacy.ts` 向生产 D1 库灌入数据并运行对账 SQL 校验。
  - [ ] 分阶段切换老版导航前端的接口配置：
    - [ ] 阶段一：仅将只读 GET 流量切换到 Workers v1，观察有无数据渲染异常。
    - [ ] 阶段二：将写流量（POST/DELETE/生成）切入，完成最终迁移。

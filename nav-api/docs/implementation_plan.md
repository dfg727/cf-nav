# Cloudflare Workers / Pages 接口迁移方案 (v1/v2 多版本兼容设计)

本项目计划将原 Python (FastAPI) + SQLite 本地存储的 `sitenav`（网址导航）模块，迁移到 **Cloudflare Workers** 平台。

为了兼顾**前端零修改平滑过渡**与**后端现代化演进**，我们采用**双表物理结构底座 + 多版本路由 API** 的双规设计方案：

- **物理数据层**：采用现代化的双表（`categories` 分类表 与 `sites` 站点表）物理结构，并使用 **Drizzle ORM** 进行强类型数据库操作。
- **v1 接口层 (`/api/v1/*`)**：向后兼容。在 Worker 内存层进行数据结构转换，将双表数据拼接并还原为原 Python 的单表 `SiteItem` 格式，对老版前端完全透明。
- **v2 接口层 (`/api/v2/*`)**：现代化演进。直接提供针对双表的标准化 RESTful OpenAPI 接口。

---

## 1. 物理数据库表结构 (D1 + Drizzle ORM)

我们在 Cloudflare D1 数据库中建立如下双表结构：

### categories (分类表)

```sql
CREATE TABLE categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pid INTEGER,                        -- 父级分类ID (根节点为 NULL 或 0)
    name TEXT NOT NULL,                  -- 分类名称
    sort_order INTEGER DEFAULT 0,        -- 排序权重
    is_public INTEGER DEFAULT 1,         -- 是否公开 (0=私有, 1=公开)
    is_expand INTEGER DEFAULT 0,         -- 是否默认展开
    status INTEGER DEFAULT 1,            -- 状态 (1=启用, 0=禁用)
    created_at INTEGER                   -- 创建时间戳
);
```

### sites (具体网址表)

```sql
CREATE TABLE sites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER REFERENCES categories(id), -- 所属分类 ID
    name TEXT NOT NULL,                 -- 网站名称
    url TEXT NOT NULL,                  -- 网站 URL
    inner_url TEXT,                     -- 内网备用 URL
    description TEXT,                   -- 描述
    icon TEXT,                          -- 图标 (Favicon)
    status INTEGER DEFAULT 1,           -- 状态 (1=启用, 0=禁用)
    is_public INTEGER DEFAULT 1,        -- 是否公开
    sort_order INTEGER DEFAULT 0,       -- 排序权重
    created_at INTEGER,
    updated_at INTEGER
);
```

### 索引设计

`nav-api` 现有的 `drizzle/0000_orange_whizzer.sql` 未包含任何除主键外的索引，且 `sites.category_id` 的外键声明为 `ON DELETE no action`（即删除分类不会自动级联，级联逻辑必须完全由应用层实现，见第 2 节路由设计与第 4 节数据完整性）。树形接口 (`/tree`) 与 v1 适配层在每次请求时都要做「按 `pid`/`category_id` 分组 + 按 `sort_order` 排序」的全表扫描，数据量增长后会退化为线性扫描。为此新增以下索引：

```sql
-- 按父分类查找子分类（分类树展开、级联删除时的子孙遍历）
CREATE INDEX idx_categories_pid ON categories(pid);

-- 按分类查找站点（树形接口的高频访问路径）
CREATE INDEX idx_sites_category_id ON sites(category_id);

-- 公开只读接口的过滤 + 排序复合索引（is_public/status 是公开树形接口的 WHERE 条件，sort_order 是 ORDER BY 字段）
CREATE INDEX idx_sites_public_status_sort ON sites(is_public, status, sort_order);
CREATE INDEX idx_categories_public_status_sort ON categories(is_public, status, sort_order);
```

这些索引需要在 Drizzle Schema (`src/db/schema.ts`) 中通过 `index()` / `uniqueIndex()` 一并声明，确保 `drizzle-kit generate` 产出的迁移文件与实际 D1 结构一致，而不是仅手写 SQL（否则下次 `drizzle-kit generate` 会因为「schema 与实际库不一致」生成多余的 diff）。

参考当前实际数据规模（原 Python 版本 `sqlite_index.sql` + `sqlite_other.sql` 合计约 170 行记录），索引带来的收益在短期内主要是「面向未来」而非「解决当下性能问题」，但由于 D1 按行读取计费（详见第 6 节），提前建好索引可以避免数据量增长后一次性全表扫描导致的读取行数暴涨。

---

## 2. API 版本设计与路由映射

接口基础路径划分为 `/api/v1` 和 `/api/v2`，所有接口默认开启 CORS。

### v1 接口兼容层 (兼容老版扁平格式与字段)

v1 接口在响应前，通过 **适配器 (Adapter)** 将双表查询结果映射为原单表 `SiteItem` 类型：

- **`favicon`** 映射自 `sites.icon`
- **`uri`** 映射自 `sites.url`
- **`pId`** 映射自 `categories.pid` 或 `sites.categoryId`
- **`category`** 属性判别：根据其所属的顶级根分类 ID（或名称）判别为 `"index"` 还是 `"other"`。
- **`desc`** 映射自 `sites.description`

#### v1 数据适配转换逻辑 (TypeScript 示例)

为了解决 `categories`（分类表）和 `sites`（站点表）作为两张独立的物理表各自拥有独立的自增主键 `id`，导致合并输出给 v1 接口时可能发生的 **ID 冲突碰撞** 隐患（例如：分类 A 拥有 `id=10`，站点 B 亦拥有 `id=10` 且其 `categoryId` 是 10，这将导致父子层级混乱或自循环引用），我们引入 **ID 命名空间隔离机制**：

- **分类节点 ID**：直接使用原始物理主键 `categories.id`（自增起点为 1，正常运行范围 `[1, 9999999]`）。
- **站点节点 ID**：`sites` 表的物理自增起点在迁移脚本中被预先设为 `10,000,000`（做法见下方 WARNING 说明），因此 `sites.id` 本身就落在 `[10000000, +∞)` 区间，v1 输出时**直接返回物理主键即可，不需要任何运行时加减运算**。由于站点只作为树形结构的叶子节点，它的 `pId` 依然正确指向其所属分类的原始物理 ID（如 `pId = 5`）。这既维持了准确的父子绑定，又彻底隔离了 ID。
- **操作接口还原**：当 v1 接口接收到增删改请求（例如 `DELETE /api/v1/sites/:id`）时，后端通过 ID 大小做逻辑分流：若 `id >= 10000000` 则在 `sites` 表中执行操作；若 `id < 10000000`，则直接在 `categories` 表中进行级联操作。这一分流判断统一收敛在 `v1IdCodec.ts` 的 `decodeV1Id()` 中，不允许在路由代码里出现裸的阈值比较。

> [!WARNING]
> **已确定方案：把 `sites` 表的物理自增起点直接设到 `10,000,000`，不引入独立 ID 映射表**
>
> 放弃「先用 1 起始的自增 id，再在读时 `+ 10000000`」的运行时加减，改为让 `sites.id` 物理上就从 `10,000,000` 开始自增，`categories.id` 保持从 1 开始。这样 v1 输出 `id` 时不需要任何算术运算，直接返回物理主键即可。**但需要明确：这只是去掉了加减运算，风险本质没变**——`categories.id` 依然是「只增不减」的计数器，依然存在长期运行后逼近 `10,000,000` 的可能，因此仍然需要保留告警阈值检查；`decodeV1Id` 这类「按大小判断属于哪张表」的路由逻辑也依然需要（v1 前端把分类和站点当成同一棵树的节点，`DELETE /api/v1/sites/:id` 这类请求传入的 id 后端仍要判断落在哪张表），只是不再需要 `+`/`-` 这一步。
>
> **如何让 `sites` 自增起点落在 `10,000,000`**：不建议直接写 D1 的 `sqlite_sequence` 系统表（是否允许应用层直接写该表取决于 D1 的具体限制，未经验证不应作为方案基础）。更可靠、可移植的做法是利用 SQLite `AUTOINCREMENT`「历史最大已用 id 只增不减、即使删除也不会被复用」的语义，在迁移脚本最开始插入一条显式指定 `id = 9999999` 的占位行、随即删除它，之后所有未显式指定 id 的插入都会从 `10000000` 开始：
>
> ```typescript
> // scripts/migrate-legacy.ts —— 在阶段一插入任何真实站点数据之前执行一次
> async function seedSiteAutoIncrementFloor(db: DrizzleD1Database) {
>   await db.insert(sites).values({
>     id: 9_999_999, // 显式指定，仅用于把 AUTOINCREMENT 计数器推高，随后立即删除
>     categoryId: null,
>     name: '__seed_floor__',
>     url: 'about:blank',
>     status: 0,
>   });
>   await db.delete(sites).where(eq(sites.id, 9_999_999));
>   // 之后 db.insert(sites)（不指定 id）的第一条记录会得到 id = 10000000
> }
> ```
>
> `src/adapters/v1IdCodec.ts` 相应简化为：不再做加减运算，只保留「按阈值判断属于哪张表」的路由函数和分类计数器的告警检查（阈值检查不能删——它是这套方案唯一的「静默数据错乱」预警手段）：
>
> ```typescript
> // src/adapters/v1IdCodec.ts
> // sites 物理自增起点已在迁移脚本中设为 10,000,000，此处只做路由判断，不做加减。
> export const SITE_ID_FLOOR = 10_000_000;
>
> // 安全阈值：分类自增计数器一旦越过此线就必须报警并停止写入。
> const CATEGORY_ID_ALARM_THRESHOLD = 8_000_000;
>
> export type V1NodeRef = { table: 'category' | 'site'; rawId: number };
>
> // 读写两侧统一使用这一个函数做分流判断，禁止在路由代码里出现裸的 `>= 10000000` 字面量
> export function decodeV1Id(v1Id: number): V1NodeRef {
>   return v1Id >= SITE_ID_FLOOR
>     ? { table: 'site', rawId: v1Id }
>     : { table: 'category', rawId: v1Id };
> }
>
> // 在每次分类写操作（POST /api/v2/categories、迁移脚本）后调用，
> // 越过阈值时应触发告警（日志 + 监控指标）——这是本方案下唯一的"提前发现即将碰撞"的手段。
> export async function assertCategoryIdHeadroom(db: DrizzleD1Database): Promise<void> {
>   const seq = await db.get<{ seq: number }>(
>     sql`SELECT seq FROM sqlite_sequence WHERE name = 'categories'`,
>   );
>   if (seq && seq.seq >= CATEGORY_ID_ALARM_THRESHOLD) {
>     throw new Error(
>       `[v1IdCodec] categories 自增计数器 (${seq.seq}) 已逼近 SITE_ID_FLOOR (${SITE_ID_FLOOR})，` +
>       `v1 兼容层的 ID 隔离假设即将失效，需要人工介入。`,
>     );
>   }
> }
> ```

```typescript
// 依赖上面 v1IdCodec.ts 的 SITE_ID_FLOOR——本文件不重复定义偏移常量。
interface SiteItemV1 {
  id: number;
  pId: number;
  name: string;
  desc: string | null;
  uri: string | null;
  isExpand: number;
  favicon: string | null;
  status: number;
  category: 'index' | 'other';
  orderNum: number;
}

// 转换分类节点为 v1 格式 (ID 不变)
function mapCategoryToV1(cat: any, rootCategoryName: string): SiteItemV1 {
  return {
    id: cat.id,
    pId: cat.pid || 0,
    name: cat.name,
    desc: '',
    uri: null,
    isExpand: cat.isExpand ? 1 : 0,
    favicon: null,
    status: cat.status,
    category: rootCategoryName.toLowerCase().includes('other') ? 'other' : 'index',
    orderNum: cat.sortOrder || 0
  };
}

// 转换站点节点为 v1 格式（sites.id 物理上已经从 SITE_ID_FLOOR=10000000 起自增，直接返回，无需加减）
function mapSiteToV1(site: any, catIdToRootName: Map<number, string>): SiteItemV1 {
  const rootName = catIdToRootName.get(site.categoryId) || 'index';
  return {
    id: site.id, // 物理主键本身已落在 [SITE_ID_FLOOR, +∞) 区间，天然与 categories.id 隔离
    pId: site.categoryId || 0,     // 依然指向父分类的原生 ID
    name: site.name,
    desc: site.description || '',
    uri: site.url,
    isExpand: 0,
    favicon: site.icon || null,
    status: site.status,
    category: rootName.toLowerCase().includes('other') ? 'other' : 'index',
    orderNum: site.sortOrder || 0
  };
}
```

#### v1 路由设计表

| 方法             | 路由                                    | 说明                                    | 转换逻辑                                                                                                                                                 |
| :--------------- | :-------------------------------------- | :-------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **GET**    | `/api/v1/sites`                       | 获取 v1 格式的扁平站点与分类组合列表    | 查询所有的 categories 和 sites，通过 Adapter 合并并统一转换为`SiteItemV1[]` 数组。                                                                     |
| **GET**    | `/api/v1/sites/tree`                  | 获取 v1 树形嵌套结构                    | 先转换成`SiteItemV1[]` 扁平数组，再在内存中以 `pId` 组装树形。                                                                                       |
| **POST**   | `/api/v1/sites`                       | 保存站点 (支持元数据爬取与 v1 参数输入) | 解析 v1 格式输入，智能写入 D1 数据库。如无 id 且有 uri 但无 desc，则触发`HTMLRewriter` 网页爬虫。                                                      |
| **DELETE** | `/api/v1/sites/:id`                   | 级联删除指定 ID 的节点                  | 如果删除的是分类 ID，需递归查询所有子分类与子站点并全部删除。                                                                                            |
| **GET**    | `/api/v1/sites/generate`              | **动态生成 JS 代码流 (方案 A)**   | 读取 D1 中相应 category 下的 v1 树形数据，序列化为 JS 文本：`const [category]_site_list = [...]`，设置 `Content-Type: application/javascript` 输出。 |
| **GET**    | `/api/v1/sites/fetch_metadata`        | 提取目标网页元数据                      | 请求目标网页，利用`HTMLRewriter` 提取并返回 title、description 和 favicon。                                                                            |
| **POST**   | `/api/v1/sites/update_metadata_batch` | 批量更新缺失 favicon 的站点元数据       | 找出所有 icon 为空的站点，并发提取元数据并更新至 D1。                                                                                                    |

#### v1 路由设计补充说明

- **`is_public` / `status` 过滤不能只在 v2 做，v1 也必须做**：原方案给出的 `mapCategoryToV1` / `mapSiteToV1` 转换函数只做字段映射，没有任何可见性过滤，等价于把所有私有(`is_public=0`)、禁用(`status=0`)的分类和站点都暴露在了公开的 v1 只读接口上。`nav-api` 现有的 `src/routes/sites.ts`、`src/routes/categories.ts` 已经实现了正确的模式——按请求头 `api-key` 是否匹配 `env.API_KEY` 判定 `isAdmin`，`isAdmin` 时返回全部数据，否则只返回 `is_public=1 AND status=1` 的数据。v1 适配层的查询函数必须复用同一判定逻辑，在拼表阶段就做过滤，而不是转换完再过滤（否则 `catIdToRootName` 之类的辅助 Map 会包含不该暴露的分类名称，造成信息泄露）。
- **鉴权范围（已确定：GET 也强制鉴权）**：`nav-api` 现有的 `authMiddleware`（`src/middleware/auth.ts` 第12-16行）只对非 `GET` 请求校验 `api-key` 头：

  ```typescript
  if (c.req.method !== 'GET') {
      if (apiKey !== validApiKey) {
          return c.json({ error: 'Unauthorized' }, 401);
      }
  }
  ```

  `nav-api2` 需要把这个 `if (method !== 'GET')` 的豁免去掉，改成所有方法（含 `GET`）统一校验 `api-key`，未带 key 或 key 不匹配一律 `401`。凭证机制不变，仍是同一个 `api-key` 请求头、同一个 key 值，只是不再允许匿名访问。

  > [!NOTE]
  > **单一 Key 模型下 `is_public`/`status` 过滤会失去意义**：现有代码里 `isAdmin` 就是通过同一个 `api-key` 是否匹配 `validApiKey` 判定的。一旦 `GET` 也强制要求这同一个 key，那么"能通过鉴权访问接口"和"是 admin"就变成了同一件事——不存在"已认证但非管理员，只能看公开数据"这一中间档位。也就是说 v1/v2 里针对 `is_public=1 AND status=1` 的过滤逻辑，对所有能调用接口的调用方都不会再生效（因为能调用就意味着拿到了 key，拿到 key 就等于是 admin）。如果未来需要"持有只读 key 的第三方只能看公开数据"这种中间档位，需要引入第二个 key（例如 `READ_API_KEY`）并让 `isAdmin` 判定与"是否通过鉴权"判定分开，这是本方案当前范围之外的扩展点，先记录在此。
  >
- **`DELETE /api/v1/sites/:id` 的级联删除算法必须写清楚**：`nav-api` 现有的 `DELETE /api/v2/categories/:id`（见 `src/routes/categories.ts`）目前只是 `db.delete(categories).where(eq(categories.id, id))`，**没有任何级联逻辑**，且 `sites.category_id` 外键声明为 `ON DELETE no action`，删除分类会直接留下悬空的 `category_id` 孤儿站点和孤儿子分类。v1/v2 的级联删除必须在应用层实现广度优先遍历（与原 Python `SiteItem.delete()` 的迭代式子孙查找等价），示例：

  ```typescript
  async function cascadeDeleteCategory(db: DrizzleD1Database, rootCategoryId: number) {
    const toDelete = [rootCategoryId];
    for (let i = 0; i < toDelete.length; i++) {
      const children = await db.select({ id: categories.id })
        .from(categories).where(eq(categories.pid, toDelete[i]));
      toDelete.push(...children.map(c => c.id));
    }
    // 先删子表（sites 引用 categories），避免外键悬空
    await db.delete(sites).where(inArray(sites.categoryId, toDelete));
    await db.delete(categories).where(inArray(categories.id, toDelete));
  }
  ```

  这一函数应作为 v1 适配层与 v2 `DELETE /api/v2/categories/:id` 共用的唯一实现，避免两套版本各写一份、行为不一致。
- **`GET /api/v1/sites/generate` 必须使用安全序列化，禁止字符串拼接**：原 Python 实现（`source/sitenav/generate_js.py`）使用 `json.dumps(js_data, ensure_ascii=False)` 生成 `const {category}_site_list = {...}`，天然对 `name`/`desc`/`uri` 中的引号、反斜杠、`</script>` 等做了转义。方案文档目前只写"序列化为 JS 文本"，没有指明序列化方式——如果实现时用模板字符串直接拼接数据库字段（例如 `` `{name:"${site.name}",uri:"${site.uri}"}` ``），站点的 `name`/`description` 字段中只要包含一个双引号就能逃逸出字符串字面量、注入任意 JS，而这个端点的响应又是设计给旧前端 `<script src="...generate?...">` 直接引入执行的——这是一个存储型 XSS/脚本注入通道。**必须对齐原实现**，用 `JSON.stringify()` 生成数据部分：

  ```typescript
  const js = `const ${category}_site_list = ${JSON.stringify(treeData)};`;
  return c.body(js, 200, {
    'Content-Type': 'application/javascript; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
  });
  ```

  `JSON.stringify` 的输出对 `<`, `>`, `"`, `\` 都是安全的（唯一需要注意的边界是 `</script>` 中的 `/`，`JSON.stringify` 不会转义它；如果该 JS 有可能被内联进 `<script>` 标签而非以 `<script src>` 外链引入，需要额外对 `/` 后跟 `script` 的序列做转义）。
- **`GET /api/v1/sites/fetch_metadata` 与 `HTMLRewriter` 爬虫的 SSRF 防护未提及，需要补充**：该端点接受任意用户传入的 `url` 参数并由 Worker 边缘节点发起请求，是典型的 SSRF 攻击面。原 Python 版本（`source/sitenav/site_metadata.py`）只做了 `urlparse` 的 scheme/netloc 非空校验和 10 秒超时，**没有做内网地址过滤**，这个薄弱点在迁移时不应原样照抄，需要加强：

  - 仅允许 `http:`/`https:` scheme；拒绝 `file:`、`data:`、`javascript:` 等（沿用原表结构可见部分历史数据本身就含有 `javascript:void(0);`，见第 4 节）。
  - 对目标主机做 DNS 解析后校验解析出的 IP 不在私有/保留网段（`10.0.0.0/8`、`172.16.0.0/12`、`192.168.0.0/16`、`127.0.0.0/8`、`169.254.0.0/16`——尤其要挡住 `169.254.169.254` 云元数据端点、`::1`、`fc00::/7`）。Cloudflare Workers 的 `fetch()` 默认会拒绝直连大部分私有地址，但这是平台行为、不是应用层保证，**不能作为唯一防线**，仍需在应用层显式校验，并对 3xx 重定向的落地地址重新校验（防止「合法公网 URL 302 到内网地址」绕过）。
  - `inner_url` 字段明确是"内网备用 URL"，**绝不能**被传入面向公网的 `fetch_metadata`/爬虫逻辑——需要在路由层面确保爬虫只消费用户显式传入的 `url` 查询参数，不会意外把 `inner_url` 也一起抓取。
  - 使用 `AbortSignal.timeout(10_000)` 限制超时，并通过 `HTMLRewriter` 流式解析时设置响应体读取上限（例如超过 1MB 后中止），避免恶意目标返回超大响应拖垮 Worker 或耗尽内存。
- **`POST /api/v1/sites/update_metadata_batch` 的并发与超时未提及**：Cloudflare Workers 对单次请求的子请求数量与 CPU/墙钟时间有平台限制（具体额度取决于 Workers 付费方案，需在实现前查阅当前账号的 Workers 限制文档确认）。若"缺失 favicon 的站点"数量较多，在一个请求处理函数里用 `Promise.all` 无限并发发起外部 `fetch` 很容易超出子请求上限或超时。建议：

  - 用小并发窗口（例如一次 5～10 个）分批 `fetch`，而不是一次性全量并发。
  - 单次批处理请求设置总量上限（例如一次最多处理 50 条），超出部分返回下一页的续传游标，由调用方分次触发，或改造成 Cloudflare Queues / Workflows 驱动的后台任务，接口本身立即返回 `202 Accepted` + 任务 ID，避免让前端长时间挂起等待一个可能超时的请求。

---

### v2 接口标准层 (现代双表结构 RESTful API)

v2 接口直接面向 `categories` 和 `sites` 双表进行资源化管理，使用标准命名，不再做 v1 的降级与拼接。

#### v2 路由设计表

| 方法             | 路由                       | 说明                                  | 对应表操作                                    |
| :--------------- | :------------------------- | :------------------------------------ | :-------------------------------------------- |
| **GET**    | `/api/v2/categories`     | 获取分类扁平列表                      | 查询`categories` 表                         |
| **POST**   | `/api/v2/categories`     | 新增分类                              | 插入`categories` 表                         |
| **PUT**    | `/api/v2/categories/:id` | 修改分类                              | 更新`categories` 表                         |
| **DELETE** | `/api/v2/categories/:id` | 删除分类                              | 删除分类，可配置是否级联删除站点              |
| **GET**    | `/api/v2/sites`          | 获取站点列表 (支持按 categoryId 过滤) | 查询`sites` 表                              |
| **POST**   | `/api/v2/sites`          | 新增站点 (内部集成元数据爬取)         | 插入`sites` 表                              |
| **PUT**    | `/api/v2/sites/:id`      | 修改站点                              | 更新`sites` 表                              |
| **DELETE** | `/api/v2/sites/:id`      | 删除特定站点                          | 从`sites` 表中删除指定行                    |
| **GET**    | `/api/v2/sites/tree`     | 获取全新的标准化双表树形结构          | 标准双表树嵌套输出 (分类包含子分类和站点列表) |

#### v2 路由设计补充说明

- **分页**：`GET /api/v2/sites` 与 `GET /api/v2/categories` 目前设计为返回全量列表。参照当前实际数据规模（原 Python 版本合计约 170 条记录），短期内全量返回没有性能问题，**不需要为此过度设计**；但方案应显式声明这一前提，并为将来扩容预留标准的 `limit`/`offset`（或 `cursor`）查询参数位，避免数据量增长后是一次「破坏性」的接口变更。v1 兼容层由于要保持与旧前端字段 100% 一致，不引入分页参数。
- **`DELETE /api/v2/categories/:id` 的级联行为**：路由表中「可配置是否级联删除站点」需要明确默认值与参数名——建议默认 `cascade=false` 时返回 `409 Conflict`（分类下仍有子分类或站点时拒绝删除），显式传 `?cascade=true` 时才执行 v1 章节给出的 `cascadeDeleteCategory` 递归删除。避免"删除分类"默认行为在两个版本间不一致（v1 强制级联，v2 若默认级联会让习惯 REST 语义的调用方感到意外）。

---

## 3. 本地开发、数据同步与迁移步骤

1. **项目骨架准备**：
   可以直接在已有的 `nav-api` 项目（已配置好 Hono + Zod + Drizzle）基础上进行演进，将其路由与逻辑结构化划分，并原样迁移 `src/middleware/auth.ts` 中的 `authMiddleware` 与 `src/index.ts` 中的 CORS 配置（见第 5 节"安全性"）。
2. **编写数据迁移脚本 (`scripts/migrate-legacy.ts`)**：
   - 编写一段 TypeScript 脚本，用于读取 Python 原生的 `sqlite_index.sql` 与 `sqlite_other.sql`。
   - 解析出历史 SQL 中的插入语句，将单表记录智能清洗分流为 `categories` 和 `sites` 的 Drizzle 模型实例。
   - **不能简单地"分流插入"了事**：两个物理表各自拥有独立的 `AUTOINCREMENT` 主键，插入后产生的新 ID 与原 SQL 文件里的旧 ID（如 `1000`、`2006`）不会相同，而 `sites` 对 `categories` 的外键、`categories` 之间的父子 `pid` 都是通过旧 ID 表达的。必须做**两阶段迁移 + ID 映射**，完整算法与边界情况（脏数据行、悬空引用）见第 4 节，这是整个迁移里唯一会导致"静默产出结构性错误数据"的步骤，优先级高于其他所有任务。
   - 插入本地或 Cloudflare 云端 D1 数据库中，且脚本必须可重复执行（幂等）：重复运行不应产生重复数据，建议先 `DELETE FROM sites; DELETE FROM categories;`（或用一个专门的空库）再导入，并在脚本开头加执行前置检查。
3. **编写 `HTMLRewriter` 解析器**：
   - 使用 Workers 内置的 `HTMLRewriter` 实现实时爬取 URL 对应网页的标题、描述及 Favicon 图标，需落实第 2 节列出的 SSRF 防护（scheme 校验、私网 IP 过滤、重定向重新校验、超时与响应体大小限制）。
4. **运行与测试**：
   - 使用 `wrangler dev` 启动本地服务，验证以下端点的输出与原 Python FastAPI 响应 100% 一致，**而不只是 `index` 分类的树形接口**：
     - `GET /api/v1/sites/tree?category=index` 与 `GET /api/v1/sites/tree?category=other`（两个源文件都要覆盖，`other` 数据量更大、层级更深，是更严格的回归用例）。
     - `GET /api/v1/sites`（扁平列表）在 `index`/`other` 两种取值下的输出。
     - `GET /api/v2/categories`、`GET /api/v2/sites`、`GET /api/v2/sites/tree`（确认双表数据本身是对的，不依赖 v1 适配层"看起来正确"来间接验证——v1 的 pId 拼接可能掩盖底层数据错误）。
     - 至少一条写路径的回归：`POST /api/v1/sites` 新增站点后能在 `GET .../tree` 中正确出现在其分类下；`DELETE /api/v1/sites/:id`（对分类 ID）后确认其所有子孙分类与站点均被清除、且不残留孤儿行。
   - 验证方法应做成可重复运行的对比脚本（对旧 Python 服务与新 Worker 服务的响应做结构化 diff），而不是人工用 `curl` 抽查几次——这是唯一能在后续每次改动（比如索引调整、schema 演进）时低成本重新确认"没有破坏兼容性"的方式。
5. **回滚与灰度切换**：
   - 云端 D1 生产库执行迁移前，先 `wrangler d1 export <db> --output backup-$(date).sql` 落一份完整备份；迁移脚本对生产库的写入建议先在一个同 schema 的临时 D1 库（或本地 `wrangler dev` 的本地 D1 模拟）跑一遍，人工确认第 4 节的校验查询全部通过后，再对生产库执行。
   - 切换旧前端接口地址到 `/api/v1/*` 时分阶段进行：先只切只读的 `GET` 流量（`/sites`、`/sites/tree`、`/sites/generate`），观察一段时间无异常后再切写流量（`POST`/`DELETE`），因为读路径出问题只是"显示错误"，写路径出问题是"数据被错误地增删"，后者的回滚成本高得多、且如果和用户实时操作交织在一起，仅靠"从备份回滚"会丢失切换期间的新增数据。

---

## 4. ID 映射与数据完整性（迁移正确性保障）

这是本方案中风险最高、也是原方案交代最不清楚的一步：如果处理不当，**产出的结果是"迁移脚本成功跑完、没有报错，但站点全部挂错了分类"**——这种错误在人工抽查时很容易被忽略（页面能正常渲染，只是父子关系是错的），必须靠结构化校验才能发现。

### 4.1 问题的真实数据来源

实际检查 `source/sitenav/sqlite_index.sql`（48 行）与 `source/sitenav/sqlite_other.sql`（144 行）后确认：

- 原 Python 单表 `site_item` 的 `id` 是**人工指定的业务编号**，不是从 1 开始的连续自增值（例如 `1000`／`1010`／`1020`……`2000`／`2006`／`2007`……），`pId` 直接引用同表内的其它 `id`。
- `sqlite_index.sql` 使用 `1000` 起的 ID 段，`sqlite_other.sql` 使用 `2000` 起的 ID 段——两者**碰巧**不重叠，但这只是历史巧合，不是任何约束保证的结果，**迁移脚本不能依赖"两个文件的 ID 段不会重叠"这个假设**（例如以后有人在 `index` 侧补录数据到 3000 号段，只要和 `other` 侧的号段撞了，任何按 ID 区间做判断的逻辑都会静默出错）。
- 双表方案里 `categories` 与 `sites` 各自拥有独立的、从 1 开始的 D1 `AUTOINCREMENT` 主键。这意味着**插入后产生的新 ID 与原 SQL 文件里的旧 ID 必然不同**（旧 `id=1000` 的分类插入 `categories` 后可能变成新 `id=1`），而 `sites.category_id` 原本是通过旧 `pId`（如 `1000`）表达从属关系的——如果迁移脚本直接把旧 `pId` 塞进新的 `sites.category_id` 或 `categories.pid`，产生的外键会指向新表里一个**碰巧存在、但语义完全无关**的行（或者指向压根不存在的 ID，变成悬空引用），而不会报错——SQLite 默认不强制外键约束，D1 目前也未在本方案的 schema 中启用 `PRAGMA foreign_keys = ON`。
- **分类判定规则已确定简化为 `uri IS NULL`**：逐行核查两份 SQL 文件后确认，所有分类行的 `uri` 字段值均为 SQL `NULL`（例如 `sqlite_index.sql` 里 `id=1000` 的 "Common Sites" 分类：`..., 'Common Sites', '', NULL, 1, 1, ...`），**没有任何一行分类使用空字符串 `''` 作为占位**——因此单纯判断 `uri IS NULL` 就足以且能够安全地识别所有真实分类行，不需要额外处理空字符串的情况。
- **但 `uri IS NULL` 判定不到、需要单独过滤的脏数据**：`sqlite_other.sql` 中有 6 行（原 ID `2007`/`2012`/`2014`/`2016`/`2019`/`2108`）的 `name` 为空字符串、`uri` 为 `'javascript:void(0);'`——这个 `uri` **不是 NULL**，如果只用 `uri IS NULL` 一条规则判断，这 6 行会落入"非分类"分支、被当成站点导入，在 `nav-api2` 里产生一批名称为空、点击无效的"幽灵站点"。这 6 行和"分类 vs 站点"的判定是两个独立的问题：前者是"排除明显无效的历史死数据"，后者才是"分类/站点"的二元判断，二者不冲突——`uri IS NULL` 依然是分类判定的唯一规则，死链行则在此之前作为单独一类"应跳过的脏行"处理。经核查，这些 ID **均未被其它任何行引用为 `pId`**（不是任何节点的父节点），跳过它们不会产生悬空引用。

### 4.2 两阶段迁移 + 临时旧→新 ID 对照表算法

> 注意与第 2 节的区分：这里的"旧 ID → 新 ID 对照"是**迁移脚本运行期间的临时内存 Map**，只为了把老 SQL 文件里的业务编号正确翻译成新表的物理主键，脚本跑完即可丢弃，不落库、不持久化；它和第 2 节里讨论过、**已被否决**的"持久化 `v1_id_map` 表"方案是两回事——后者是要在 v1 接口长期运行时替代物理主键做 ID 隔离，本节的对照表只服务于一次性迁移。

正确做法是把迁移拆成"先落地所有分类、记录旧 ID→新 ID 映射，再用这份映射落地所有站点与分类间的父子关系"两个阶段，任何时候都不能假设新旧 ID 相等：

```typescript
// scripts/migrate-legacy.ts（核心逻辑，简化版）

interface RawRow {
  oldId: number;
  oldPid: number;
  name: string;
  desc: string | null;
  uri: string | null;
  isExpand: number;
  status: number;
  category: 'index' | 'other'; // 来源文件标记，写入后不再需要，仅用于迁移期校验
  orderNum: number;
}

// 历史遗留的死链占位符：uri 非空但不是有效链接，且 name 也为空——既不是分类也不是可用站点，应被跳过。
// 这一判断和"分类 vs 站点"的判断相互独立：分类判定只看 uri 是否为 NULL（见下方 isCategoryRow）。
const JUNK_URI_VALUES = new Set(['javascript:void(0);', 'javascript:;', '#']);

function isDeadPlaceholderRow(row: RawRow): boolean {
  return row.uri != null && JUNK_URI_VALUES.has(row.uri.trim()) && row.name.trim() === '';
}

// 已核实两份源 SQL 文件里所有分类行的 uri 均为 SQL NULL、不存在空字符串占位，
// 因此分类判定只需要这一条规则，不需要再额外判断空字符串。
function isCategoryRow(row: RawRow): boolean {
  return row.uri == null;
}

async function migrate(db: DrizzleD1Database, rawRows: RawRow[]) {
  // 判定顺序很重要：死链占位符必须在分类判定之前被过滤掉，
  // 否则 `javascript:void(0);` 这类"非空但无效"的 uri 会被 isCategoryRow 判定为"非 NULL 即站点"、当成合法站点导入。
  const skipped: RawRow[] = [];
  const categoryRows: RawRow[] = [];
  const siteRows: RawRow[] = [];
  for (const row of rawRows) {
    if (isDeadPlaceholderRow(row)) { skipped.push(row); continue; }
    if (isCategoryRow(row)) { categoryRows.push(row); continue; }
    siteRows.push(row);
  }

  // 在插入任何真实站点数据之前，先把 sites 表的物理自增起点推高到 10,000,000
  // （具体实现见第 2 节 v1 ID 隔离机制中的 seedSiteAutoIncrementFloor）。
  await seedSiteAutoIncrementFloor(db);

  // 阶段一：插入所有分类，pid 先留空，同时建立 旧ID -> 新ID 映射。
  // 必须先建好映射再回填 pid，因为子分类可能在父分类之前被处理到（原表不保证插入顺序即层级顺序）。
  const oldToNewCategoryId = new Map<number, number>();
  for (const row of categoryRows) {
    const [inserted] = await db.insert(categories).values({
      name: row.name,
      sortOrder: row.orderNum,
      isExpand: !!row.isExpand,
      status: row.status,
      pid: null, // 占位，阶段二回填
    }).returning({ id: categories.id });
    oldToNewCategoryId.set(row.oldId, inserted.id);
  }

  // 阶段二 a：回填分类之间的父子关系（pid 也要经过映射，不能直接复用旧值）
  for (const row of categoryRows) {
    if (row.oldPid === 0) continue; // 0 表示根节点，保持 pid = NULL
    const newParentId = oldToNewCategoryId.get(row.oldPid);
    if (newParentId == null) {
      // 悬空引用：旧数据里 pId 指向的行不存在，或指向了一个被当作"站点"分类的行——需要人工核查，不能静默忽略
      throw new Error(`[migrate] category old_id=${row.oldId} 的 pId=${row.oldPid} 找不到对应的新分类，数据可能存在结构性问题`);
    }
    await db.update(categories)
      .set({ pid: newParentId })
      .where(eq(categories.id, oldToNewCategoryId.get(row.oldId)!));
  }

  // 阶段二 b：插入站点，categoryId 通过同一份映射转换，而不是直接使用旧 pId
  for (const row of siteRows) {
    const newCategoryId = oldToNewCategoryId.get(row.oldPid);
    if (newCategoryId == null) {
      throw new Error(`[migrate] site old_id=${row.oldId} 的 pId=${row.oldPid} 找不到对应的新分类，无法确定所属分类，需要人工核查`);
    }
    await db.insert(sites).values({
      categoryId: newCategoryId,
      name: row.name,
      url: row.uri!,
      description: row.desc || null,
      icon: null,
      sortOrder: row.orderNum,
      status: row.status,
    });
  }

  return { migratedCategories: categoryRows.length, migratedSites: siteRows.length, skipped };
}
```

关键设计点：

- **悬空引用必须 `throw`，不能 `continue` 静默跳过**——迁移脚本的默认行为应该是"宁可失败退出，也不要产出一条挂错分类的脏数据"。如果确认某些悬空引用是历史遗留的正常现象（例如原表就存在少量断链），应该显式加入一个「已知例外」白名单并在日志中明确写出被跳过的原始 ID，而不是让异常被吞掉。
- **`skipped`（判定为死链占位符的行）必须被记录到迁移报告里**，供人工复核确认这些原始 ID 确实不需要保留，而不是脚本自己决定丢弃。

### 4.3 迁移后校验（对齐第 3 节步骤 4，但聚焦在数据完整性而非 API 输出格式）

在人工确认迁移结果、切流量之前，至少要跑通以下 SQL 层面的校验，任何一条不满足都不能判定迁移成功：

```sql
-- 1. 不允许有站点的 category_id 悬空（引用了不存在的分类）
SELECT COUNT(*) FROM sites s
LEFT JOIN categories c ON s.category_id = c.id
WHERE s.category_id IS NOT NULL AND c.id IS NULL; -- 期望结果：0

-- 2. 不允许有分类的 pid 悬空
SELECT COUNT(*) FROM categories c1
LEFT JOIN categories c2 ON c1.pid = c2.id
WHERE c1.pid IS NOT NULL AND c2.id IS NULL; -- 期望结果：0

-- 3. 不允许出现自引用或循环引用（分类把自己或自己的祖先设为父节点）
--    可用递归 CTE 遍历每个节点到根的路径，检查路径中是否出现重复 ID

-- 4. 总行数对账：迁移后 categories+sites 的行数，
--    应等于原始两份 SQL 文件的总 INSERT 行数减去被判定为"死链占位符"而跳过的行数，
--    且这个差值必须与迁移脚本日志中 `skipped.length` 完全一致（对不上说明分类逻辑本身有遗漏）。
```

只有这四类校验全部通过，才进入第 3 节步骤 5 的灰度切换。

---

## 5. 安全性（鉴权、XSS、SSRF）

> 本节汇总第 2 节中按接口分散提出的安全要求，作为整体安全基线单独列出，避免实现时遗漏。

### 5.1 鉴权与访问控制

- **复用而非重造，且去掉 `GET` 豁免**：`nav-api` 已实现 `src/middleware/auth.ts` 的 `authMiddleware`，但目前只对非 `GET` 请求校验 `api-key`。**已确定**：`nav-api2` 挂载这一中间件时去掉 `method !== 'GET'` 的条件判断，让 `/api/v1/*` 与 `/api/v2/*` 的所有方法（含 `GET`）统一要求合法 `api-key`，未带或错误一律 `401`。同时把 `isAdmin` 过滤模式带入 v1 适配层（第 2 节已指出原方案的 `mapCategoryToV1`/`mapSiteToV1` 目前没有做这层过滤，是需要修复的缺口）——不过如第 2 节 NOTE 所述，在单一 key 模型下鉴权通过即等价于 `isAdmin`，这层过滤目前不会真正区分出"非管理员"档位，只作为架构上保留的扩展点。
- **`API_KEY` 的密钥管理**：当前 `nav-api/wrangler.toml` 里 `API_KEY` 明文写在 `[vars]` 里（`"secret-api-key"`，且是示例弱密钥），随源码提交。`nav-api2` 部署到生产环境时应改用 `wrangler secret put API_KEY` 写入加密的 Secret，而不是继续放在 `wrangler.toml` 的 `[vars]` 明文段——这一条虽然不是本方案新增的问题，但既然要做平台迁移，应当一并修正，否则会把同样的弱口令问题带进新项目。在 `GET` 也强制鉴权之后，这个 key 的重要性从"防止误操作写入"上升为"唯一的数据访问门槛"，明文提交的风险等级也随之提高，更不能再拖延。

### 5.2 `GET /api/v1/sites/generate` 的脚本注入（XSS）防护

见第 2 节详细说明：**必须使用 `JSON.stringify()` 生成数据字面量，禁止用模板字符串直接拼接数据库字段**，否则站点 `name`/`description`/`url` 中的引号可以逃逸出 JS 字符串字面量，注入任意脚本。这是对原 Python 实现（已经用 `json.dumps` 正确处理了这一点）的**一次潜在回归**，如果方案落地时不显式对齐，很容易被漏掉——因为无论转义与否，输出的 JS 语法在正常数据下看起来都是"能跑"的，只有输入包含特殊字符时才会暴露问题，属于容易被测试遗漏的一类缺陷。

### 5.3 `fetch_metadata` / `update_metadata_batch` 的 SSRF 与资源耗尽防护

见第 2 节详细说明：scheme 白名单、DNS 解析后的私网/保留网段过滤（含云元数据地址 `169.254.169.254`）、重定向落地地址二次校验、请求超时（`AbortSignal.timeout`）、响应体大小上限、以及批量端点的并发窗口限制与请求总量上限。`inner_url` 字段专门标注为"内网备用 URL"，爬虫/元数据抓取逻辑不应处理它。

---

## 6. 索引与性能

- 具体索引定义见第 1 节"索引设计"，覆盖 `categories.pid`、`sites.category_id` 与 `(is_public, status, sort_order)` 复合索引，需要在 Drizzle Schema 中一并声明并纳入 `drizzle-kit generate` 产出的迁移文件，而不是脱离 Schema 手写。
- **D1 的计费与限额是按行读取/写入计的**（而非传统数据库的连接数/QPS 模型），全表扫描在数据量小的时候不明显，但会随数据量增长直接体现在读取行数上；本方案当前数据规模（约 170 条记录）远低于需要担心限额的量级，但既然引入了分类树的递归遍历（级联删除、树形接口），**接口实现时应避免 N+1 查询**——例如 `cascadeDeleteCategory` 里对每一层级都发一次 SQL 查询是可接受的（层级深度有限，原始数据最深 3 层），但 v1/v2 的 `/tree` 接口必须保持"一次查询取回全部 `categories` + 一次查询取回全部 `sites`，再在内存中用 Map 组装"的模式（`nav-api` 现有 `src/routes/categories.ts`、`src/routes/sites.ts` 已经是这个模式），而不是对每个分类单独发一次子查询。
- 实现前应查阅当前 Cloudflare 账号所在套餐的 D1 存储上限、单次查询返回行数上限、Workers 单请求子请求数与 CPU/墙钟时间上限，并将结论（哪怕结论是"当前规模远低于限额，无需特别处理"）明确写入部署文档，而不是留空。

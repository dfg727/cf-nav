import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { categories, sites } from '../db/schema';
import { getV1SitesFlat, buildV1Tree } from '../adapters/v1Adapter';
import { decodeV1Id, assertCategoryIdHeadroom } from '../adapters/v1IdCodec';
import { fetchMetadataFromUrl } from '../utils/metadata';
import { Bindings } from '../bindings';
import { cascadeDeleteCategory } from '../db/utils';
import { isRootBucketCategory, resolveRootBucketId } from '../rootCategories';
import {
    SiteItemV1Schema,
    SiteItemV1TreeSchema,
    FetchMetadataResponseSchema,
    UpdateMetadataBatchResponseSchema,
    SaveSiteV1BodySchema,
    SaveSiteV1ResponseSchema,
    DeleteSiteV1ResponseSchema,
    ErrorSchema
} from '../schemas';

const app = new OpenAPIHono<{ Bindings: Bindings }>();

const TAGS = ['V1 Legacy'];

// 1. 获取 v1 格式扁平列表
const getFlatSitesRoute = createRoute({
    method: 'get',
    path: '/',
    tags: TAGS,
    summary: 'Get v1 flat site list',
    description: 'Get site list in v1 flat format, compatibility layer.',
    security: [{ apiKey: [] }],
    request: {
        query: z.object({
            category: z.string().optional().default('index').openapi({
                description: 'Filter category: index or other',
                example: 'index',
            }),
        }),
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: z.array(SiteItemV1Schema),
                },
            },
            description: 'Flat list of sites',
        },
    },
});

app.openapi(getFlatSitesRoute, async (c) => {
    const db = drizzle(c.env.DB);
    const { category } = c.req.valid('query');

    const flatSites = await getV1SitesFlat(db, category);
    return c.json(flatSites);
});

// 2. 获取 v1 格式嵌套树形结构
const getTreeSitesRoute = createRoute({
    method: 'get',
    path: '/tree',
    tags: TAGS,
    summary: 'Get v1 nested tree sites',
    description: 'Get tree structure in v1 nested format, compatibility layer.',
    security: [{ apiKey: [] }],
    request: {
        query: z.object({
            category: z.string().optional().default('index').openapi({
                description: 'Filter category: index or other',
                example: 'index',
            }),
        }),
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: z.array(SiteItemV1TreeSchema),
                },
            },
            description: 'Tree structures of sites',
        },
    },
});

app.openapi(getTreeSitesRoute, async (c) => {
    const db = drizzle(c.env.DB);
    const { category } = c.req.valid('query');

    const flatSites = await getV1SitesFlat(db, category);
    const treeSites = buildV1Tree(flatSites);
    return c.json(treeSites);
});

// 3. 动态导出 JS 数据流 (方案 A，带 JSON.stringify 防注入)
const generateJsStreamRoute = createRoute({
    method: 'get',
    path: '/generate',
    tags: TAGS,
    summary: 'Generate JS stream',
    description: 'Dynamically export JavaScript data stream containing tree sites.',
    security: [{ apiKey: [] }],
    request: {
        query: z.object({
            category: z.string().optional().default('index').openapi({
                description: 'Filter category: index or other',
                example: 'index',
            }),
        }),
    },
    responses: {
        200: {
            content: {
                'application/javascript': {
                    schema: z.string().openapi({ description: 'JavaScript code snippet' }),
                },
            },
            description: 'JavaScript data stream content',
        },
    },
});

app.openapi(generateJsStreamRoute, async (c) => {
    const db = drizzle(c.env.DB);
    const { category } = c.req.valid('query');

    const flatSites = await getV1SitesFlat(db, category);
    const treeSites = buildV1Tree(flatSites);

    // 采用安全序列化输出，防范 XSS 注入风险
    const jsContent = `const ${category}_site_list = ${JSON.stringify(treeSites, null, 4)};`;

    return c.body(jsContent, 200, {
        'Content-Type': 'application/javascript; charset=utf-8',
        'X-Content-Type-Options': 'nosniff'
    });
});

// 4. 边缘网页元数据抓取
const fetchMetadataRoute = createRoute({
    method: 'get',
    path: '/fetch_metadata',
    tags: TAGS,
    summary: 'Fetch page metadata',
    description: 'Fetch title, description and favicon of a web page dynamically.',
    security: [{ apiKey: [] }],
    request: {
        query: z.object({
            url: z.string().openapi({
                description: 'Target website URL',
                example: 'https://github.com',
            }),
        }),
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: FetchMetadataResponseSchema,
                },
            },
            description: 'Fetched metadata result',
        },
        400: {
            content: {
                'application/json': {
                    schema: ErrorSchema,
                },
            },
            description: 'Bad request',
        },
    },
});

app.openapi(fetchMetadataRoute, async (c) => {
    const { url } = c.req.valid('query');
    const metadata = await fetchMetadataFromUrl(url);
    return c.json({ code: 200, data: metadata }, 200);
});

// 5. 批量更新缺失 favicon 的元数据
const updateMetadataBatchRoute = createRoute({
    method: 'post',
    path: '/update_metadata_batch',
    tags: TAGS,
    summary: 'Batch update empty favicons',
    description: 'Batch update sites that are missing favicons in the database.',
    security: [{ apiKey: [] }],
    request: {
        query: z.object({
            category: z.string().openapi({
                description: 'Target category filter',
                example: 'index',
            }),
        }),
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: UpdateMetadataBatchResponseSchema,
                },
            },
            description: 'Batch update results',
        },
        400: {
            content: {
                'application/json': {
                    schema: ErrorSchema,
                },
            },
            description: 'Bad request',
        },
    },
});

app.openapi(updateMetadataBatchRoute, async (c) => {
    const db = drizzle(c.env.DB);
    const { category } = c.req.valid('query');

    const flatSites = await getV1SitesFlat(db, category);
    // 找出所有物理主键在 sites 范围，且 icon 为空/NULL 的行
    const emptyIconSites = flatSites.filter(
        item => item.id >= 10000000 && (!item.favicon || item.favicon.trim() === '') && item.uri
    );

    const limit = 50; // 单次批量总量限制，防超时
    const batchList = emptyIconSites.slice(0, limit);

    let updatedCount = 0;
    const concurrency = 5; // 小并发窗口控制，一次最多处理 5 个请求

    for (let i = 0; i < batchList.length; i += concurrency) {
        const chunk = batchList.slice(i, i + concurrency);
        await Promise.all(chunk.map(async (site) => {
            if (!site.uri) return;
            const meta = await fetchMetadataFromUrl(site.uri);
            if (!meta.error) {
                const updateData: { icon?: string; description?: string } = {};
                if (meta.favicon) updateData.icon = meta.favicon;
                if (meta.description) updateData.description = meta.description;

                if (Object.keys(updateData).length > 0) {
                    await db.update(sites)
                        .set(updateData)
                        .where(eq(sites.id, site.id));
                    updatedCount++;
                }
            }
        }));
    }

    return c.json({
        code: 200,
        message: `Updated ${updatedCount} sites`,
        total_candidates: emptyIconSites.length,
        processed_in_this_batch: batchList.length
    }, 200);
});

// 6. 保存或修改节点 (旧单表合一入口)
const saveSiteV1Route = createRoute({
    method: 'post',
    path: '/',
    tags: TAGS,
    summary: 'Create or update v1 site/category node',
    description: 'Save or modify v1 node. If id query parameter is provided, performs update; otherwise creates a new node.',
    security: [{ apiKey: [] }],
    request: {
        query: z.object({
            id: z.string().optional().openapi({
                description: 'Unique node V1 ID (optional). If present, performs update.',
            }),
        }),
        body: {
            content: {
                'application/json': {
                    schema: SaveSiteV1BodySchema,
                },
            },
        },
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: SaveSiteV1ResponseSchema,
                },
            },
            description: 'Node saved successfully',
        },
    },
});

app.openapi(saveSiteV1Route, async (c) => {
    const db = drizzle(c.env.DB);
    const { id: idStr } = c.req.valid('query');
    const body = c.req.valid('json');

    const pId = body.pId;
    const name = body.name;
    const desc = body.desc;
    const uri = body.uri;
    const isExpand = body.isExpand;
    const favicon = body.favicon;
    const status = body.status;
    const orderNum = body.orderNum;

    // 判定是否是分类节点
    const isCategory = !uri || uri.toUpperCase() === 'NULL' || uri.trim() === 'javascript:void(0);';

    // pId=0 在 v1 语义里是"挂到 body.category（index/other/h5）这个桶的顶层"，
    // 不能直接写成 pid=NULL/categoryId=0——那样会让节点变成真正脱离所有桶的孤儿，
    // 下次读取时会按其（不存在的）根节点 name 兜底判成 other，和调用方传入的 category 对不上。
    const resolvedParentId = pId === 0 ? await resolveRootBucketId(db, body.category) : pId;

    if (idStr) {
        // 更新逻辑
        const id = parseInt(idStr, 10);
        const ref = decodeV1Id(id);

        if (ref.table === 'category') {
            await db.update(categories)
                .set({
                    pid: resolvedParentId,
                    name: name,
                    sortOrder: orderNum,
                    isExpand: isExpand === 1,
                    status: status
                })
                .where(eq(categories.id, ref.rawId));
        } else {
            await db.update(sites)
                .set({
                    categoryId: resolvedParentId,
                    name: name,
                    url: uri,
                    description: desc,
                    icon: favicon,
                    status: status,
                    sortOrder: orderNum
                })
                .where(eq(sites.id, ref.rawId));
        }
        return c.json({ code: 200, message: "Site item saved successfully" });
    } else {
        // 新增逻辑
        if (isCategory) {
            await db.insert(categories).values({
                pid: resolvedParentId,
                name: name,
                sortOrder: orderNum,
                isExpand: isExpand === 1,
                status: status
            });
            // 报警阈值检查
            await assertCategoryIdHeadroom(db);
        } else {
            let finalName = name;
            let finalDesc = desc;
            let finalIcon = favicon;

            // 若无 desc 且 uri 有效，触发网页元数据抓取填充
            if (uri && !desc) {
                const meta = await fetchMetadataFromUrl(uri);
                if (!meta.error) {
                    if (meta.title && !name) finalName = meta.title;
                    if (meta.description) finalDesc = meta.description;
                    if (meta.favicon) finalIcon = meta.favicon;
                }
            }

            await db.insert(sites).values({
                categoryId: resolvedParentId,
                name: finalName,
                url: uri,
                description: finalDesc,
                icon: finalIcon,
                status: status,
                sortOrder: orderNum
            });
        }
        return c.json({ code: 200, message: "Site item saved successfully" });
    }
});

// 7. 删除节点 (级联分流删除)
const deleteSiteV1Route = createRoute({
    method: 'delete',
    path: '/{id}',
    tags: TAGS,
    summary: 'Delete site or category node',
    description: 'Deletes a node based on v1 ID. Handles cascade deletion if it is a category.',
    security: [{ apiKey: [] }],
    request: {
        params: z.object({
            id: z.string().openapi({
                description: 'Unique node V1 ID to delete',
                example: '1',
            }),
        }),
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: DeleteSiteV1ResponseSchema,
                },
            },
            description: 'Node deleted successfully',
        },
        400: {
            content: {
                'application/json': {
                    schema: ErrorSchema,
                },
            },
            description: 'Bad request',
        },
    },
});

app.openapi(deleteSiteV1Route, async (c) => {
    const db = drizzle(c.env.DB);
    const { id: idStr } = c.req.valid('param');

    const id = parseInt(idStr, 10);
    const ref = decodeV1Id(id);

    if (ref.table === 'category') {
        // index/other/h5 是受保护的根分类容器，删除会让整棵子树失去分类归属，禁止删除。
        const target = await db.select({ pid: categories.pid, name: categories.name })
            .from(categories)
            .where(eq(categories.id, ref.rawId));
        if (target[0] && isRootBucketCategory(target[0])) {
            return c.json(
                { error: `Category "${target[0].name}" is a protected root bucket (index/other/h5) and cannot be deleted.` },
                400
            );
        }
        await cascadeDeleteCategory(db, ref.rawId);
    } else {
        await db.delete(sites).where(eq(sites.id, ref.rawId));
    }

    return c.json({ code: 200, message: "Site item deleted successfully" }, 200);
});

export default app;

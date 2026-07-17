import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { eq, asc } from 'drizzle-orm';
import { categories, sites } from '../db/schema';
import { Bindings } from '../bindings';
import { CategorySchema, SiteSchema, CreateSiteSchema, ErrorSchema } from '../schemas';
import { fetchMetadataFromUrl } from '../utils/metadata';
import { getDb } from '../db/client';
import { toCategoryDTO, toSiteDTO } from '../db/serializers';

const app = new OpenAPIHono<{ Bindings: Bindings }>();

const TAGS = ['Sites'];

const getSitesRoute = createRoute({
    method: 'get',
    path: '/',
    tags: TAGS,
    summary: 'Get all sites',
    description: 'Get all sites. Optionally filter by categoryId.',
    security: [{ apiKey: [] }],
    request: {
        query: z.object({
            categoryId: z.string().optional().openapi({
                param: { name: 'categoryId', in: 'query', description: 'Filter sites by category id' },
                example: '1000',
            }),
        }),
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: z.array(SiteSchema),
                },
            },
            description: 'List of sites',
        },
        500: {
            content: {
                'application/json': {
                    schema: ErrorSchema,
                },
            },
            description: 'Server error',
        },
    },
});

const CategorySiteTreeSchema = CategorySchema.extend({
    type: z.literal('category').openapi({ example: 'category' }),
    children: z.array(z.any()).default([]),
});

const SiteTreeNodeSchema = SiteSchema.extend({
    type: z.literal('site').openapi({ example: 'site' }),
    children: z.array(z.any()).default([]),
});

const TreeResultSchema = z.union([CategorySiteTreeSchema, SiteTreeNodeSchema]);

const getSiteTreeRoute = createRoute({
    method: 'get',
    path: '/tree',
    tags: TAGS,
    summary: 'Get site tree by categories',
    description: 'Get a tree structure of categories and sites, with categories, sites under each category, subcategories, and sites under subcategories. Optionally filter by category name. Only enabled (status=1) categories/sites are included.',
    security: [{ apiKey: [] }],
    request: {
        query: z.object({
            category: z.string().openapi({
                param: { name: 'category', in: 'query', description: 'Category name to filter tree by' },
                example: 'h5',
            }),
        }),
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: z.array(TreeResultSchema),
                },
            },
            description: 'Category-site tree',
        },
        500: {
            content: {
                'application/json': {
                    schema: ErrorSchema,
                },
            },
            description: 'Server error',
        },
    },
});

const createSiteRoute = createRoute({
    method: 'post',
    path: '/',
    tags: TAGS,
    summary: 'Create a site',
    security: [{ apiKey: [] }],
    request: {
        body: {
            content: {
                'application/json': {
                    schema: CreateSiteSchema,
                },
            },
        },
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: SiteSchema,
                },
            },
            description: 'Created site',
        },
        500: {
            content: {
                'application/json': {
                    schema: ErrorSchema,
                },
            },
            description: 'Server error',
        },
    },
});

const updateSiteRoute = createRoute({
    method: 'put',
    path: '/{id}',
    tags: TAGS,
    summary: 'Update a site',
    security: [{ apiKey: [] }],
    request: {
        params: z.object({
            id: z.string().transform(v => Number(v)),
        }),
        body: {
            content: {
                'application/json': {
                    schema: CreateSiteSchema.partial(),
                },
            },
        },
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: SiteSchema,
                },
            },
            description: 'Updated site',
        },
        404: {
            content: {
                'application/json': {
                    schema: ErrorSchema,
                },
            },
            description: 'Site not found',
        },
        500: {
            content: {
                'application/json': {
                    schema: ErrorSchema,
                },
            },
            description: 'Server error',
        },
    },
});

const deleteSiteRoute = createRoute({
    method: 'delete',
    path: '/{id}',
    tags: TAGS,
    summary: 'Delete a site',
    security: [{ apiKey: [] }],
    request: {
        params: z.object({
            id: z.string().transform(v => Number(v)),
        }),
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: z.object({ success: z.boolean() }),
                },
            },
            description: 'Deleted successfully',
        },
        500: {
            content: {
                'application/json': {
                    schema: ErrorSchema,
                },
            },
            description: 'Server error',
        },
    },
});

// Handlers
app.openapi(getSitesRoute, async (c) => {
    const db = getDb(c);
    if (!db) return c.json({ error: 'Database not available' }, 500);

    const { categoryId } = c.req.valid('query');
    const rows = categoryId
        ? await db.select().from(sites).where(eq(sites.categoryId, Number(categoryId))).orderBy(asc(sites.sortOrder))
        : await db.select().from(sites).orderBy(asc(sites.sortOrder));
    return c.json(rows.map(toSiteDTO), 200);
});

app.openapi(getSiteTreeRoute, async (c) => {
    const db = getDb(c);
    if (!db) return c.json({ error: 'Database not available' }, 500);

    const allCategories = await db.select().from(categories)
        .where(eq(categories.status, 1))
        .orderBy(asc(categories.sortOrder));

    const allSites = await db.select().from(sites)
        .where(eq(sites.status, 1))
        .orderBy(asc(sites.sortOrder));

    type CategoryTreeNode = ReturnType<typeof toCategoryDTO> & { type: 'category'; children: (CategoryTreeNode | SiteTreeNode)[] };
    type SiteTreeNode = ReturnType<typeof toSiteDTO> & { type: 'site'; children: [] };

    const categoryMap = new Map<number, CategoryTreeNode>();

    for (const cat of allCategories) {
        categoryMap.set(cat.id, { ...toCategoryDTO(cat), type: 'category', children: [] });
    }

    for (const site of allSites) {
        if (site.categoryId == null) continue;
        const catNode = categoryMap.get(site.categoryId);
        if (catNode) {
            catNode.children.push({ ...toSiteDTO(site), type: 'site', children: [] });
        }
    }

    for (const node of categoryMap.values()) {
        const pid = node.pid;
        if (pid != null && pid !== 0) {
            const parent = categoryMap.get(pid);
            if (parent) {
                parent.children.push(node);
            }
        }
    }

    const { category: categoryFilter } = c.req.valid('query');
    const matched = Array.from(categoryMap.values()).find((node) =>
        node.name === categoryFilter && (node.pid === null || node.pid === 0)
    );

    if (matched) {
        return c.json(matched.children, 200);
    }

    return c.json([], 200);
});

app.openapi(createSiteRoute, async (c) => {
    const body = c.req.valid('json');
    const db = getDb(c);
    if (!db) return c.json({ error: 'Database not available' }, 500);

    let finalName = body.name;
    let finalDesc = body.description;
    let finalIcon = body.icon;

    // 若无描述或图标，则尝试自动爬取元数据补全
    if (body.url && (!finalDesc || !finalIcon)) {
        const meta = await fetchMetadataFromUrl(body.url);
        if (!meta.error) {
            if (!finalName && meta.title) finalName = meta.title;
            if (!finalDesc && meta.description) finalDesc = meta.description;
            if (!finalIcon && meta.favicon) finalIcon = meta.favicon;
        }
    }

    const res = await db.insert(sites).values({
        categoryId: body.categoryId,
        name: finalName,
        url: body.url,
        innerUrl: body.innerUrl,
        description: finalDesc,
        icon: finalIcon,
        tags: body.tags,
        status: body.status,
        isPublic: body.isPublic,
        sortOrder: body.sortOrder,
        updatedAt: new Date(),
    }).returning();
    return c.json(toSiteDTO(res[0]), 200);
});

app.openapi(updateSiteRoute, async (c) => {
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    const db = getDb(c);
    if (!db) return c.json({ error: 'Database not available' }, 500);

    const res = await db.update(sites).set({
        ...body,
        updatedAt: new Date(),
    }).where(eq(sites.id, id)).returning();

    if (!res[0]) return c.json({ error: 'Site not found' }, 404);
    return c.json(toSiteDTO(res[0]), 200);
});

app.openapi(deleteSiteRoute, async (c) => {
    const { id } = c.req.valid('param');
    const db = getDb(c);
    if (!db) return c.json({ error: 'Database not available' }, 500);

    await db.delete(sites).where(eq(sites.id, id));
    return c.json({ success: true }, 200);
});

export default app;

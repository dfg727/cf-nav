import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { drizzle } from 'drizzle-orm/d1';
import { eq, asc, and } from 'drizzle-orm';
import { categories, sites } from '../db/schema';
import { Bindings } from '../bindings';
import { CategorySchema, SiteSchema, CreateSiteSchema, ErrorSchema } from '../schemas';

const app = new OpenAPIHono<{ Bindings: Bindings }>();

const getSitesRoute = createRoute({
    method: 'get',
    path: '/',
    summary: 'Get all sites',
    request: {
        headers: z.object({
            'api-key': z.string().openapi({ param: { name: 'api-key', in: 'header' } }).optional(),
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
    summary: 'Get site tree by categories',
    description: 'Get a tree structure of categories and sites, with categories, sites under each category, subcategories, and sites under subcategories. Optionally filter by category name.',
    request: {
        query: z.object({
            category: z.string().openapi({
                param: { name: 'category', in: 'query', description: 'Category name to filter tree by' },
                example: 'h5',
            }),
        }),
        headers: z.object({
            'api-key': z.string().openapi({ param: { name: 'api-key', in: 'header' } }).optional(),
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
    },
});

const updateSiteRoute = createRoute({
    method: 'put',
    path: '/{id}',
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
    },
});

const deleteSiteRoute = createRoute({
    method: 'delete',
    path: '/{id}',
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
    },
});

// Handlers
app.openapi(getSitesRoute, async (c) => {
    if (!c.env?.DB) return c.json({ error: 'Database not available' } as any, 500);
    const db = drizzle(c.env.DB);
    const apiKey = c.req.header('api-key');
    const validApiKey = c.env?.API_KEY || 'secret-api-key';
    const isAdmin = apiKey === validApiKey;

    let query;
    if (isAdmin) {
        query = db.select().from(sites).orderBy(asc(sites.sortOrder));
    } else {
        query = db.select().from(sites).where(eq(sites.isPublic, true)).orderBy(asc(sites.sortOrder));
    }
    const allSites = await query;
    return c.json(allSites as any);
});

app.openapi(getSiteTreeRoute, async (c) => {
    if (!c.env?.DB) return c.json({ error: 'Database not available' } as any, 500);
    const db = drizzle(c.env.DB);
    const apiKey = c.req.header('api-key');
    const validApiKey = c.env?.API_KEY || 'secret-api-key';
    const isAdmin = apiKey === validApiKey;

    let categoryQuery;
    if (isAdmin) {
        categoryQuery = db.select().from(categories)            
            .where(eq(categories.status, 1))
            .orderBy(asc(categories.sortOrder));
    } else {
        categoryQuery = db
            .select()
            .from(categories)
            .where(
                and(
                    eq(categories.isPublic, true),
                    eq(categories.status, 1), // only enabled categories for public tree
                ),
            )
            .orderBy(asc(categories.sortOrder));
    }

    let siteQuery;
    if (isAdmin) {
        siteQuery = db.select().from(sites)
            .where(eq(sites.status, 1))
            .orderBy(asc(sites.sortOrder));
    } else {
        siteQuery = db
            .select()
            .from(sites)
            .where(
                and(
                    eq(sites.isPublic, true),
                    eq(sites.status, 1), // only enabled sites for public tree
                ),
            )
            .orderBy(asc(sites.sortOrder));
    }

    const allCategories = (await categoryQuery) as any[];
    const allSites = (await siteQuery) as any[];

    const categoryMap = new Map<number, any>();

    for (const cat of allCategories) {
        categoryMap.set(cat.id, { ...cat, type: 'category', children: [] });
    }

    for (const site of allSites) {
        if (site.categoryId == null) continue;
        const catNode = categoryMap.get(site.categoryId);
        if (catNode) {
            catNode.children.push({ ...site, type: 'site', children: [] });
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
    const matched = Array.from(categoryMap.values()).find((node: any) => 
        node.name === categoryFilter && (node.pid === null || node.pid === 0)
    );

    if (matched) {
        return c.json(matched.children as any);
    }

    return c.json([]);
});

app.openapi(createSiteRoute, async (c) => {
    const body = c.req.valid('json');
    if (!c.env?.DB) return c.json({ error: 'Database not available' } as any, 500);
    const db = drizzle(c.env.DB);
    const res = await db.insert(sites).values({
        categoryId: body.categoryId,
        name: body.name,
        url: body.url,
        innerUrl: body.innerUrl,
        description: body.description,
        icon: body.icon,
        tags: body.tags,
        status: body.status,
        isPublic: body.isPublic,
        sortOrder: body.sortOrder,
        updatedAt: new Date(),
    }).returning();
    return c.json(res[0] as any);
});

app.openapi(updateSiteRoute, async (c) => {
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    if (!c.env?.DB) return c.json({ error: 'Database not available' } as any, 500);
    const db = drizzle(c.env.DB);
    const res = await db.update(sites).set({
        ...body,
        updatedAt: new Date(),
    }).where(eq(sites.id, id)).returning();
    return c.json(res[0] as any);
});

app.openapi(deleteSiteRoute, async (c) => {
    const { id } = c.req.valid('param');
    if (!c.env?.DB) return c.json({ error: 'Database not available' } as any, 500);
    const db = drizzle(c.env.DB);
    await db.delete(sites).where(eq(sites.id, id));
    return c.json({ success: true });
});

export default app;

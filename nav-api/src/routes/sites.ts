import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { drizzle } from 'drizzle-orm/d1';
import { eq, asc } from 'drizzle-orm';
import { sites } from '../db/schema';
import { Bindings } from '../bindings';
import { SiteSchema, CreateSiteSchema, ErrorSchema } from '../schemas';

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

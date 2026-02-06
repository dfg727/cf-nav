import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { drizzle } from 'drizzle-orm/d1';
import { eq, asc } from 'drizzle-orm';
import { categories } from '../db/schema';
import { Bindings } from '../bindings';
import { CategorySchema, CreateCategorySchema, ErrorSchema } from '../schemas';

const app = new OpenAPIHono<{ Bindings: Bindings }>();

const getCategoriesRoute = createRoute({
    method: 'get',
    path: '/',
    summary: 'Get all categories',
    description: 'Get all categories. If authenticated, returns all. If public, returns only public categories.',
    request: {
        headers: z.object({
            'api-key': z.string().openapi({ param: { name: 'api-key', in: 'header' } }).optional(),
        }),
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: z.array(CategorySchema),
                },
            },
            description: 'List of categories',
        },
        500: {
            content: {
                'application/json': {
                    schema: ErrorSchema,
                },
            },
            description: 'Server error',
        }
    },
});

const createCategoryRoute = createRoute({
    method: 'post',
    path: '/',
    summary: 'Create a category',
    security: [{ apiKey: [] }],
    request: {
        body: {
            content: {
                'application/json': {
                    schema: CreateCategorySchema,
                },
            },
        },
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: CategorySchema,
                },
            },
            description: 'Created category',
        },
        401: {
            description: 'Unauthorized',
        },
        500: {
            description: 'Server error',
        }
    },
});

const updateCategoryRoute = createRoute({
    method: 'put',
    path: '/{id}',
    summary: 'Update a category',
    security: [{ apiKey: [] }],
    request: {
        params: z.object({
            id: z.string().transform(v => Number(v)),
        }),
        body: {
            content: {
                'application/json': {
                    schema: CreateCategorySchema.partial(),
                },
            },
        },
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: CategorySchema,
                },
            },
            description: 'Updated category',
        },
    },
});

const deleteCategoryRoute = createRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Delete a category',
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
app.openapi(getCategoriesRoute, async (c) => {
    if (!c.env?.DB) return c.json({ error: 'Database not available' }, 500);
    const db = drizzle(c.env.DB);
    const apiKey = c.req.header('api-key');
    const validApiKey = c.env?.API_KEY || 'secret-api-key';
    const isAdmin = apiKey === validApiKey;

    let query;
    if (isAdmin) {
        query = db.select().from(categories).orderBy(asc(categories.sortOrder));
    } else {
        query = db.select().from(categories).where(eq(categories.isPublic, true)).orderBy(asc(categories.sortOrder));
    }
    const allCategories = await query;
    return c.json(allCategories as any);
});

app.openapi(createCategoryRoute, async (c) => {
    const body = c.req.valid('json');
    if (!c.env?.DB) return c.json({ error: 'Database not available' } as any, 500);
    const db = drizzle(c.env.DB);
    const res = await db.insert(categories).values({
        name: body.name,
        sortOrder: body.sortOrder,
        isPublic: body.isPublic,
        isExpand: body.isExpand,
        status: body.status,
    }).returning();
    return c.json(res[0] as any);
});

app.openapi(updateCategoryRoute, async (c) => {
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    if (!c.env?.DB) return c.json({ error: 'Database not available' } as any, 500);
    const db = drizzle(c.env.DB);
    const res = await db.update(categories).set({
        ...body,
    }).where(eq(categories.id, id)).returning();
    return c.json(res[0] as any);
});

app.openapi(deleteCategoryRoute, async (c) => {
    const { id } = c.req.valid('param');
    if (!c.env?.DB) return c.json({ error: 'Database not available' } as any, 500);
    const db = drizzle(c.env.DB);
    await db.delete(categories).where(eq(categories.id, id));
    return c.json({ success: true });
});

export default app;

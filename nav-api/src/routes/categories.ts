import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { eq, asc } from 'drizzle-orm';
import { categories, sites } from '../db/schema';
import { Bindings } from '../bindings';
import { CategorySchema, CreateCategorySchema, ErrorSchema } from '../schemas';
import { cascadeDeleteCategory } from '../db/utils';
import { getDb } from '../db/client';
import { toCategoryDTO } from '../db/serializers';
import { isRootBucketCategory } from '../rootCategories';

const app = new OpenAPIHono<{ Bindings: Bindings }>();

const TAGS = ['Categories'];

const getCategoriesRoute = createRoute({
    method: 'get',
    path: '/',
    tags: TAGS,
    summary: 'Get all categories',
    description: 'Get all categories.',
    security: [{ apiKey: [] }],
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

const CategoryTreeSchema = CategorySchema.extend({
    children: z.array(z.any()).default([]),
});

const getCategoryTreeRoute = createRoute({
    method: 'get',
    path: '/tree',
    tags: TAGS,
    summary: 'Get category tree',
    description: 'Get categories as a tree structure based on id and pid. Only enabled (status=1) categories are included.',
    security: [{ apiKey: [] }],
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: z.array(CategoryTreeSchema),
                },
            },
            description: 'Category tree',
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

const createCategoryRoute = createRoute({
    method: 'post',
    path: '/',
    tags: TAGS,
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
    tags: TAGS,
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
        404: {
            content: {
                'application/json': {
                    schema: ErrorSchema,
                },
            },
            description: 'Category not found',
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

const deleteCategoryRoute = createRoute({
    method: 'delete',
    path: '/{id}',
    tags: TAGS,
    summary: 'Delete a category',
    security: [{ apiKey: [] }],
    request: {
        params: z.object({
            id: z.string().transform(v => Number(v)),
        }),
        query: z.object({
            cascade: z.string().optional().openapi({
                description: 'Whether to recursively delete child categories and sites. Options: true/false. Defaults to false.',
                example: 'true',
            }),
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
        409: {
            content: {
                'application/json': {
                    schema: z.object({ error: z.string() }),
                },
            },
            description: 'Category has subcategories or sites, and cascade was not set to true',
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
app.openapi(getCategoriesRoute, async (c) => {
    const db = getDb(c);
    if (!db) return c.json({ error: 'Database not available' }, 500);

    const rows = await db.select().from(categories).orderBy(asc(categories.sortOrder));
    return c.json(rows.map(toCategoryDTO), 200);
});

app.openapi(getCategoryTreeRoute, async (c) => {
    const db = getDb(c);
    if (!db) return c.json({ error: 'Database not available' }, 500);

    const rows = await db.select().from(categories)
        .where(eq(categories.status, 1))
        .orderBy(asc(categories.sortOrder));

    type CategoryTreeNode = ReturnType<typeof toCategoryDTO> & { children: CategoryTreeNode[] };
    const nodeMap = new Map<number, CategoryTreeNode>();
    const roots: CategoryTreeNode[] = [];

    for (const row of rows) {
        nodeMap.set(row.id, { ...toCategoryDTO(row), children: [] });
    }

    for (const node of nodeMap.values()) {
        const pid = node.pid;
        if (pid == null) {
            roots.push(node);
        } else {
            const parent = nodeMap.get(pid);
            if (parent) {
                parent.children.push(node);
            } else {
                roots.push(node);
            }
        }
    }

    return c.json(roots, 200);
});

app.openapi(createCategoryRoute, async (c) => {
    const body = c.req.valid('json');
    const db = getDb(c);
    if (!db) return c.json({ error: 'Database not available' }, 500);

    const res = await db.insert(categories).values({
        name: body.name,
        sortOrder: body.sortOrder,
        isPublic: body.isPublic,
        isExpand: body.isExpand,
        status: body.status,
    }).returning();
    return c.json(toCategoryDTO(res[0]), 200);
});

app.openapi(updateCategoryRoute, async (c) => {
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    const db = getDb(c);
    if (!db) return c.json({ error: 'Database not available' }, 500);

    const res = await db.update(categories).set({
        ...body,
    }).where(eq(categories.id, id)).returning();

    if (!res[0]) return c.json({ error: 'Category not found' }, 404);
    return c.json(toCategoryDTO(res[0]), 200);
});

app.openapi(deleteCategoryRoute, async (c) => {
    const { id } = c.req.valid('param');
    const { cascade } = c.req.valid('query');
    const db = getDb(c);
    if (!db) return c.json({ error: 'Database not available' }, 500);

    // index/other/h5 是受保护的根分类容器，删除会让整棵子树失去分类归属，禁止删除。
    const target = await db.select({ pid: categories.pid, name: categories.name })
        .from(categories)
        .where(eq(categories.id, id));
    if (target[0] && isRootBucketCategory(target[0])) {
        return c.json(
            { error: `Category "${target[0].name}" is a protected root bucket (index/other/h5) and cannot be deleted.` },
            409
        );
    }

    // 检查是否有子分类
    const subCats = await db.select({ id: categories.id })
        .from(categories)
        .where(eq(categories.pid, id));

    // 检查是否有站点
    const subSites = await db.select({ id: sites.id })
        .from(sites)
        .where(eq(sites.categoryId, id));

    if (subCats.length > 0 || subSites.length > 0) {
        if (cascade !== 'true') {
            return c.json(
                { error: 'Category has subcategories or sites. Delete aborted. Pass cascade=true to force recursive deletion.' },
                409
            );
        }
        // 执行级联删除
        await cascadeDeleteCategory(db, id);
    } else {
        // 直接删除单个空分类
        await db.delete(categories).where(eq(categories.id, id));
    }

    return c.json({ success: true }, 200);
});

export default app;

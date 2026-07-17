import { z } from '@hono/zod-openapi';

export const CategorySchema = z.object({
    id: z.number().openapi({ example: 1 }),
    pid: z.number().nullable().optional().openapi({ example: null }),
    name: z.string().openapi({ example: 'Dev Tools' }),
    sortOrder: z.number().default(0).openapi({ example: 0 }),
    isPublic: z.boolean().default(true).openapi({ example: true }),
    isExpand: z.boolean().default(false).openapi({ example: false }),
    status: z
        .number()
        .int()
        .default(1)
        .openapi({
            example: 1,
            description: 'Status: 0=draft, 1=enabled, 2=disabled, 3=deleted',
        }),
    createdAt: z.string().optional().openapi({ example: '2024-01-01T00:00:00Z' }),
});

export const CreateCategorySchema = CategorySchema.omit({ id: true, createdAt: true });

export const SiteSchema = z.object({
    id: z.number().openapi({ example: 1 }),
    categoryId: z.number().nullable().openapi({ example: 1 }),
    name: z.string().openapi({ example: 'GitHub' }),
    url: z.string().openapi({ example: 'https://github.com' }),
    innerUrl: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    icon: z.string().nullable().optional(),
    tags: z.string().nullable().optional(),
    status: z
        .number()
        .int()
        .default(1)
        .openapi({
            example: 1,
            description: 'Status: 0=draft, 1=enabled, 2=disabled, 3=deleted',
        }),
    isPublic: z.boolean().default(true),
    sortOrder: z.number().default(0),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
});

export const CreateSiteSchema = SiteSchema.omit({ id: true, createdAt: true, updatedAt: true });

export const ErrorSchema = z.object({
    error: z.string(),
});

// v1 Compat Schemas
export const SiteItemV1Schema = z.object({
    id: z.number().openapi({ example: 1 }),
    pId: z.number().openapi({ example: 0 }),
    name: z.string().openapi({ example: 'Dev Tools' }),
    desc: z.string().nullable().openapi({ example: 'Description' }),
    uri: z.string().nullable().openapi({ example: 'https://example.com' }),
    isExpand: z.number().openapi({ example: 0 }),
    favicon: z.string().nullable().openapi({ example: 'https://example.com/favicon.ico' }),
    status: z.number().openapi({ example: 1 }),
    category: z.enum(['index', 'other', 'h5']).openapi({ example: 'index' }),
    orderNum: z.number().openapi({ example: 0 }),
});

export const SiteItemV1TreeSchema = SiteItemV1Schema.extend({
    children: z.array(z.any()).default([]).openapi({ description: 'Child nodes' }),
});

export const MetadataResultSchema = z.object({
    url: z.string().openapi({ example: 'https://example.com' }),
    title: z.string().optional().openapi({ example: 'Example Domain' }),
    description: z.string().optional().openapi({ example: 'This domain is for use in illustrative examples...' }),
    favicon: z.string().optional().openapi({ example: 'https://example.com/favicon.ico' }),
    error: z.string().optional(),
});

export const FetchMetadataResponseSchema = z.object({
    code: z.number().openapi({ example: 200 }),
    data: MetadataResultSchema,
});

export const UpdateMetadataBatchResponseSchema = z.object({
    code: z.number().openapi({ example: 200 }),
    message: z.string().openapi({ example: 'Updated 5 sites' }),
    total_candidates: z.number().openapi({ example: 10 }),
    processed_in_this_batch: z.number().openapi({ example: 5 }),
});

export const SaveSiteV1BodySchema = z.object({
    pId: z.number().optional().default(0).openapi({ example: 0 }),
    name: z.string().optional().default('').openapi({ example: 'My Site' }),
    desc: z.string().optional().default('').openapi({ example: 'Description' }),
    uri: z.string().optional().default('').openapi({ example: 'https://example.com' }),
    isExpand: z.number().optional().default(0).openapi({ example: 0 }),
    favicon: z.string().optional().default('').openapi({ example: 'https://example.com/favicon.ico' }),
    status: z.number().optional().default(1).openapi({ example: 1 }),
    orderNum: z.number().optional().default(0).openapi({ example: 0 }),
    // 原 Python 版本里这个字段是必填的，决定挂到 index/other/h5 哪棵树。
    // nav-api2 改为从 pId 向上走到 index/other/h5 根节点推导 category，不再依赖调用方显式传入，
    // 因此这里保留字段仅用于接受/不报错老客户端仍在传的值，当前不会被读取或用于路由判断。
    category: z.enum(['index', 'other', 'h5']).optional().openapi({ example: 'index', description: 'Legacy field, accepted for backward compatibility but not used — category is now derived by walking pId up to its index/other/h5 root.' }),
});

export const SaveSiteV1ResponseSchema = z.object({
    code: z.number().openapi({ example: 200 }),
    message: z.string().openapi({ example: 'Site item saved successfully' }),
});

export const DeleteSiteV1ResponseSchema = z.object({
    code: z.number().openapi({ example: 200 }),
    message: z.string().openapi({ example: 'Site item deleted successfully' }),
});


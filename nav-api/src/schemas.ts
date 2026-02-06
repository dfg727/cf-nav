import { z } from '@hono/zod-openapi';

export const CategorySchema = z.object({
    id: z.number().openapi({ example: 1 }),
    name: z.string().openapi({ example: 'Dev Tools' }),
    sortOrder: z.number().default(0).openapi({ example: 0 }),
    isPublic: z.boolean().default(true).openapi({ example: true }),
    isExpand: z.boolean().default(false).openapi({ example: false }),
    status: z.number().default(1).openapi({ example: 1 }),
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
    status: z.number().default(1),
    isPublic: z.boolean().default(true),
    sortOrder: z.number().default(0),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
});

export const CreateSiteSchema = SiteSchema.omit({ id: true, createdAt: true, updatedAt: true });

export const ErrorSchema = z.object({
    error: z.string(),
});

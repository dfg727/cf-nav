import type { categories, sites } from './schema';

type CategoryRow = typeof categories.$inferSelect;
type SiteRow = typeof sites.$inferSelect;

/**
 * 把 Drizzle 查询出的原始行（列因未声明 .notNull() 而带 null 可能性）
 * 归一化为 API 响应 / OpenAPI schema 承诺的形状：
 * - 有 DB 默认值的列，null 时回退到与 schema.ts 一致的默认值
 * - 时间戳列从 Date 转为 ISO 字符串
 */
export function toCategoryDTO(row: CategoryRow) {
    return {
        id: row.id,
        pid: row.pid,
        name: row.name,
        sortOrder: row.sortOrder ?? 0,
        isPublic: row.isPublic ?? true,
        isExpand: row.isExpand ?? false,
        status: row.status ?? 1,
        createdAt: row.createdAt ? row.createdAt.toISOString() : undefined,
    };
}

export function toSiteDTO(row: SiteRow) {
    return {
        id: row.id,
        categoryId: row.categoryId,
        name: row.name,
        url: row.url,
        innerUrl: row.innerUrl,
        description: row.description,
        icon: row.icon,
        tags: row.tags,
        status: row.status ?? 1,
        isPublic: row.isPublic ?? true,
        sortOrder: row.sortOrder ?? 0,
        createdAt: row.createdAt ? row.createdAt.toISOString() : undefined,
        updatedAt: row.updatedAt ? row.updatedAt.toISOString() : undefined,
    };
}

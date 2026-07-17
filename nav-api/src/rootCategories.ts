import { and, eq, isNull } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { categories } from './db/schema';

// 顶级分类容器：index/other/h5 是真实存在于 categories 表里的 pid=NULL 根节点，
// 用于承载"这棵子树属于哪个历史分类桶"的归属信息，本身不是面向 v1 老前端的真实内容节点。
export const ROOT_BUCKET_NAMES = ['index', 'other', 'h5'] as const;
export type RootBucketName = (typeof ROOT_BUCKET_NAMES)[number];

export function isRootBucketCategory(cat: { pid: number | null; name: string }): boolean {
    return cat.pid === null && (ROOT_BUCKET_NAMES as readonly string[]).includes(cat.name);
}

/**
 * v1 的 pId=0 语义是"挂到 body.category（index/other/h5）这个桶的顶层"，
 * 而不是"变成一个真正脱离所有桶的孤立顶级分类"——后者会导致这个节点在下次
 * getV1SitesFlat 里按根节点 name 重新分类时，落到跟 body.category 不一致的桶。
 * 所以 pId=0 必须解析成对应桶根节点的真实物理 id，而不是直接写 NULL/0。
 */
export async function resolveRootBucketId(
    db: DrizzleD1Database,
    name: string | undefined
): Promise<number | null> {
    const normalized: RootBucketName = name && (ROOT_BUCKET_NAMES as readonly string[]).includes(name)
        ? (name as RootBucketName)
        : 'other';
    const rows = await db
        .select({ id: categories.id })
        .from(categories)
        .where(and(eq(categories.name, normalized), isNull(categories.pid)));
    return rows[0]?.id ?? null;
}

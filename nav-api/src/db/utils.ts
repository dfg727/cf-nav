import { eq, inArray } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { categories, sites } from './schema';

/**
 * 递归级联删除某个分类及其下的所有子分类和具体站点
 */
export async function cascadeDeleteCategory(db: DrizzleD1Database, rootCategoryId: number): Promise<void> {
    const toDelete = [rootCategoryId];
    
    // 广度优先搜索所有子孙分类 ID
    for (let i = 0; i < toDelete.length; i++) {
        const children = await db
            .select({ id: categories.id })
            .from(categories)
            .where(eq(categories.pid, toDelete[i]));
        
        toDelete.push(...children.map((c) => c.id));
    }
    
    // 1. 先删除所有子分类关联的具体站点（避免外键悬空）
    await db.delete(sites).where(inArray(sites.categoryId, toDelete));
    
    // 2. 删除所有的分类行
    await db.delete(categories).where(inArray(categories.id, toDelete));
}

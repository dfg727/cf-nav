import { sql } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';

// sites 物理自增起点已在迁移脚本中设为 10,000,000，此处只做路由判断，不做加减。
export const SITE_ID_FLOOR = 10_000_000;

// 安全阈值：分类自增计数器一旦越过此线就必须报警并停止写入。
const CATEGORY_ID_ALARM_THRESHOLD = 8_000_000;

export type V1NodeRef = { table: 'category' | 'site'; rawId: number };

// 读写两侧统一使用这一个函数做分流判断，禁止在路由代码里出现裸的 `>= 10000000` 字面量
export function decodeV1Id(v1Id: number): V1NodeRef {
    return v1Id >= SITE_ID_FLOOR
        ? { table: 'site', rawId: v1Id }
        : { table: 'category', rawId: v1Id };
}

// 在每次分类写操作（POST /api/v2/categories、迁移脚本等）后调用，
// 越过阈值时应触发告警（日志 + 报错）——这是本方案下唯一的"提前发现即将碰撞"的手段。
export async function assertCategoryIdHeadroom(db: DrizzleD1Database): Promise<void> {
    try {
        const result = await db.get<{ seq: number }>(
            sql`SELECT seq FROM sqlite_sequence WHERE name = 'categories'`
        );
        if (result && result.seq >= CATEGORY_ID_ALARM_THRESHOLD) {
            throw new Error(
                `[v1IdCodec] categories 自增计数器 (${result.seq}) 已逼近 SITE_ID_FLOOR (${SITE_ID_FLOOR})，` +
                `v1 兼容层的 ID 隔离假设即将失效，需要人工介入。`
            );
        }
    } catch (e) {
        // 全新数据库在未插入任何自增列数据之前，sqlite_sequence 表中没有 'categories'，此处抛出 null
        // 允许通过，但若属于真的报警拦截，则再次抛出
        if (e instanceof Error && e.message.includes('[v1IdCodec]')) {
            throw e;
        }
        console.warn(`[v1IdCodec] Headroom check warning (possibly empty database):`, e);
    }
}

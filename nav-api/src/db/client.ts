import { drizzle, DrizzleD1Database } from 'drizzle-orm/d1';
import type { Context } from 'hono';
import type { Bindings } from '../bindings';

// 统一的 D1 -> Drizzle 客户端获取入口，避免每个 handler 各自判断 c.env.DB 是否存在。
export function getDb(c: Context<{ Bindings: Bindings }>): DrizzleD1Database | null {
    if (!c.env?.DB) return null;
    return drizzle(c.env.DB);
}

import { MiddlewareHandler } from 'hono';
import { Bindings } from '../bindings';

export const authMiddleware: MiddlewareHandler<{ Bindings: Bindings }> = async (c, next) => {
    if (c.req.path.endsWith('/docs') || c.req.path.endsWith('/swagger/v1') || c.req.method === 'OPTIONS') {
        return next();
    }

    const apiKey = c.req.header('api-key');
    const validApiKey = c.env?.API_KEY || 'secret-api-key';

    if (c.req.method !== 'GET') {
        if (apiKey !== validApiKey) {
            return c.json({ error: 'Unauthorized' }, 401);
        }
    }
    await next();
};

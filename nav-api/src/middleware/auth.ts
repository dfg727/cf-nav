import { MiddlewareHandler } from 'hono';
import { Bindings } from '../bindings';

const WHITELIST = ['/docs', '/swagger'];

export const authMiddleware: MiddlewareHandler<{ Bindings: Bindings }> = async (c, next) => {
    const isWhitelisted = WHITELIST.some(path => c.req.path.includes(path));
    if (isWhitelisted || c.req.method === 'OPTIONS') {
        return next();
    }

    const apiKey = c.req.header('api-key');
    const validApiKey = c.env?.API_KEY || 'secret-api-key';

    if (apiKey !== validApiKey) {
        return c.json({ error: 'Unauthorized' }, 401);
    }
    await next();
};

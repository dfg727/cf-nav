import { OpenAPIHono } from '@hono/zod-openapi';
import { swaggerUI } from '@hono/swagger-ui';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Bindings } from './bindings';
import { authMiddleware } from './middleware/auth';
import categories from './routes/categories';
import sites from './routes/sites';
import { configureSwagger } from './config/swagger';

const api = new OpenAPIHono<{ Bindings: Bindings }>();

// Middleware
api.use('*', cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'api-key'],
    credentials: true,
}));

// Auth Middleware
api.use('*', authMiddleware);

// Routes
api.route('/categories', categories);
api.route('/sites', sites);

// Swagger Configuration
configureSwagger(api);

const app = new Hono<{ Bindings: Bindings }>();
app.get('/docs', swaggerUI({
    url: '/api/swagger/v1',
    persistAuthorization: true,
}));
app.route('/api', api);

export default app;

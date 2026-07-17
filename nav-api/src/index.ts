import { OpenAPIHono } from '@hono/zod-openapi';
import { swaggerUI } from '@hono/swagger-ui';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Bindings } from './bindings';
import { authMiddleware } from './middleware/auth';
import categories from './routes/categories';
import sites from './routes/sites';
import v1 from './routes/v1';
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

// v1 Routes (Legacy Compatibility Layer)
const v1Api = new OpenAPIHono<{ Bindings: Bindings }>();
v1Api.route('/sites', v1);

// v2 Routes (Standardized RESTful Layer)
const v2Api = new OpenAPIHono<{ Bindings: Bindings }>();
v2Api.route('/categories', categories);
v2Api.route('/sites', sites);

// Swagger Configuration
configureSwagger(v1Api, v2Api);

// Mount versioned sub APIs
api.route('/v1', v1Api);
api.route('/v2', v2Api);

const app = new Hono<{ Bindings: Bindings }>();

// swagger-ui-dist 版本统一钉死，三个 /docs* 页面共用同一个值，避免 CDN 未来切到不兼容的新版。
const SWAGGER_UI_VERSION = '5.11.0';

// 1. v1 Swagger UI (Keep for direct access if needed)
app.get('/docs/v1', swaggerUI({
    version: SWAGGER_UI_VERSION,
    url: '/api/v1/swagger/spec',
    persistAuthorization: true,
}));

// 2. v2 Swagger UI (Keep for direct access if needed)
app.get('/docs/v2', swaggerUI({
    version: SWAGGER_UI_VERSION,
    url: '/api/v2/swagger/spec',
    persistAuthorization: true,
}));

// 3. Combined Swagger UI with a built-in version dropdown switcher.
// The dropdown needs StandaloneLayout, which in turn needs swagger-ui-standalone-preset.js —
// @hono/swagger-ui's declarative options only ever load swagger-ui-bundle.js, with no way to
// add that second script. manuallySwaggerUIHtml is the escape hatch for that one extra <script>;
// everything else here mirrors what the plain `swaggerUI({...})` call above would have rendered.
app.get('/docs', swaggerUI({
    version: SWAGGER_UI_VERSION,
    title: 'CF Nav API Documentation',
    // Not actually read at runtime (manuallySwaggerUIHtml below fully overrides rendering),
    // only present because SwaggerUIOptions requires url/urls at the type level.
    urls: [],
    manuallySwaggerUIHtml: (asset) => `
        <div>
          <div id="swagger-ui"></div>
          ${asset.css.map((url) => `<link rel="stylesheet" href="${url}" />`).join('\n')}
          ${asset.js.map((url) => `<script src="${url}" crossorigin="anonymous"></script>`).join('\n')}
          <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@${SWAGGER_UI_VERSION}/swagger-ui-standalone-preset.js" crossorigin="anonymous"></script>
          <script>
            window.onload = () => {
              window.ui = SwaggerUIBundle({
                dom_id: '#swagger-ui',
                urls: [
                  { url: '/api/v2/swagger/spec', name: 'v2 (Standard)' },
                  { url: '/api/v1/swagger/spec', name: 'v1 (Legacy)' }
                ],
                deepLinking: true,
                presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
                plugins: [SwaggerUIBundle.plugins.DownloadUrl],
                layout: 'StandaloneLayout',
                persistAuthorization: true,
              });
            };
          </script>
        </div>
    `,
}));

app.route('/api', api);

export default app;




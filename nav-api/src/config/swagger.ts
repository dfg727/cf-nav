import { OpenAPIHono } from '@hono/zod-openapi';
import { Bindings } from '../bindings';

export const configureSwagger = (app: OpenAPIHono<{ Bindings: Bindings }>) => {
    // Register Security Scheme
    app.openAPIRegistry.registerComponent('securitySchemes', 'apiKey', {
        type: 'apiKey',
        in: 'header',
        name: 'api-key',
    });

    // Configure OpenAPI Document
    app.doc('/swagger/v1', {
        openapi: '3.0.0',
        info: {
            version: '1.0.0',
            title: 'Nav API',
        },
        servers: [
            {
                url: '/api',
                description: 'API Base URL',
            }
        ],
        security: [{ apiKey: [] }],
    });
};

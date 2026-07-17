import { OpenAPIHono } from '@hono/zod-openapi';
import { Bindings } from '../bindings';

export const configureSwagger = (
    v1Api: OpenAPIHono<{ Bindings: Bindings }>,
    v2Api: OpenAPIHono<{ Bindings: Bindings }>
) => {
    // Register Security Scheme for v1
    v1Api.openAPIRegistry.registerComponent('securitySchemes', 'apiKey', {
        type: 'apiKey',
        in: 'header',
        name: 'api-key',
    });

    // Configure OpenAPI Document for v1 (Legacy)
    v1Api.doc('/swagger/spec', {
        openapi: '3.0.0',
        info: {
            version: '1.0.0',
            title: 'CF Nav API v1 (Legacy)',
        },
        servers: [
            {
                url: '/api/v1',
                description: 'V1 API Base URL',
            }
        ],
        security: [{ apiKey: [] }],
    });

    // Register Security Scheme for v2
    v2Api.openAPIRegistry.registerComponent('securitySchemes', 'apiKey', {
        type: 'apiKey',
        in: 'header',
        name: 'api-key',
    });

    // Configure OpenAPI Document for v2 (Standard)
    v2Api.doc('/swagger/spec', {
        openapi: '3.0.0',
        info: {
            version: '2.0.0',
            title: 'CF Nav API v2 (Standard)',
        },
        servers: [
            {
                url: '/api/v2',
                description: 'V2 API Base URL',
            }
        ],
        security: [{ apiKey: [] }],
    });
};


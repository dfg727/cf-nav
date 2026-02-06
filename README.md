# cf-nav
基于cloudflare的导航项目

## Project Structure

This is a monorepo managed by npm workspaces.

- `nav-api`: Backend API (Cloudflare Workers, Hono, Drizzle)
- `nav-ui`: Frontend UI (Planned)

## Development

Install dependencies:

```bash
npm install
```

Run dev server for api:

```bash
# 在本地成功应用了迁移 (首次运行或Schema变更时)
npm run api:db:migrate:local
# 在本地初始化数据种子 (可选)
npm run api:db:seed:local
# 启动 api
npm run api:dev
```

## Deployment

Deploy api to Cloudflare Workers:

```bash
# 1. 迁移生产数据库 (首次部署或Schema变更时)
npm run api:db:migrate:prod

# 2. 初始化生产数据种子 (可选)
npm run api:db:seed:prod

# 3. 发布 Worker
npm run api:deploy
```


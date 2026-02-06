# 快速开始

1. 安装依赖
```bash
npm install
```

2. 初始化数据库
```bash
npm run db:migrate:local
```

3. 初始化本地数据库种子
```bash
npm run db:seed:local
```

4. 启动本地服务
```bash
npm run dev
```

5. 创建数据库迁移文件
如果修改了 `src/db/schema.ts` ，需要先生成 SQL 迁移文件
```bash
npm run db:migrate:local
```

6. 将本地的迁移应用到远程 Cloudflare D1 数据库
```bash
npm run db:migrate:remote
```

7. 初始化远程数据库种子
```bash
npm run db:seed:prod
```
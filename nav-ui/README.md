# nav-ui

CF Nav 管理后台 —— 基于 nav-api v2 接口的纯静态管理页面（HTML + Tailwind CSS + 原生 JS，无构建框架），可直接部署到 Cloudflare Pages。

## 功能

- 分类管理：树形展示（支持展开/折叠）、新建/编辑/删除（含级联删除子分类和站点的二次确认）
- 站点管理：列表展示、按分类筛选、新建/编辑/删除
- 首次打开自动弹出设置框，配置 nav-api 的 Base URL 与 `api-key`（保存在浏览器 localStorage，不写入代码）

## 目录结构

```
nav-ui/
  src/input.css       # Tailwind 源文件（含少量 @layer components）
  public/
    index.html        # 页面结构
    style.css          # 构建产物（由 input.css 生成，勿手改）
    js/
      store.js         # API 地址/密钥的 localStorage 读写
      api.js            # v2 接口的 fetch 封装
      ui.js              # toast / modal / confirm 弹窗工具
      constants.js       # 状态码 -> 文案/颜色 映射
      categories.js       # 分类树渲染 + 增删改
      sites.js             # 站点表格渲染 + 增删改
      app.js                # 入口：标签页切换、设置弹窗
```

## 本地开发

```bash
npm install          # 在仓库根目录执行一次即可（workspaces）
npm run ui:dev        # 等价于: cd nav-ui && npm run dev
```

`dev` 会先构建一次 CSS，再用 `wrangler pages dev` 在本地起一个静态服务器（默认 http://127.0.0.1:8788）。修改 `src/input.css` 后需要重新构建；如果只改 JS/HTML，刷新浏览器即可。

如需一边改 Tailwind 一边热更新 CSS：

```bash
cd nav-ui && npm run dev:css   # --watch 模式
```

首次打开页面时，在设置框里填入本地或线上 nav-api 的地址（例如 `http://127.0.0.1:8787`）和 `api-key`。

## 构建

```bash
npm run ui:build
```

产出 `nav-ui/public/style.css`（压缩版），`public/` 目录即为完整的静态站点。

## 部署到 Cloudflare Pages

```bash
npm run ui:deploy
```

等价于 `cd nav-ui && npm run build && wrangler pages deploy public --project-name=nav-ui`。首次部署会提示创建 Cloudflare Pages 项目，按提示确认即可。

部署完成后打开生成的 `*.pages.dev` 地址，在设置框里填入你的 nav-api 生产环境地址和 `api-key` 即可开始管理。

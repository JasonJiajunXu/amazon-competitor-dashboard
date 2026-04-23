# Amazon 竞品调研看板

这是一套可以直接发布到 `GitHub Pages` 的静态网站，不需要 `Metabase` 账号，也不需要每月付费。

## 目录

- `data/`
  - 抽取后的结构化数据
  - `sellersprite_status.json` 保存 SellerSprite 跟踪配置和同步状态
  - `sellersprite_daily.json` 保存近 14 日 SellerSprite 日销量样例/快照
- `site/`
  - 前端看板页面
- `scripts/extract_competitor_reports.py`
  - 从原始 HTML 抽数据
- `metabase/`
  - 如果你未来要接数据库或 BI 工具，可以直接复用这套表结构
- `.github/workflows/deploy-pages.yml`
  - 自动发布到 GitHub Pages

## 现在怎么发布

1. 把当前目录推到 GitHub 的一个公开仓库
2. 仓库默认分支设为 `main`
3. 在 GitHub 仓库里打开 `Settings -> Pages`
4. Source 选 `GitHub Actions`
5. 推送一次代码，等待工作流 `Deploy competitor dashboard to GitHub Pages` 跑完

## 发布后链接

默认会是：

- `https://<你的 GitHub 用户名>.github.io/<仓库名>/`

如果你用的是用户主页仓库 `<username>.github.io`，那就是：

- `https://<你的 GitHub 用户名>.github.io/`

## 当前数据来源

当前页面使用的是这份文件里抽出来的静态数据：

- `/Users/jasonjiajunxu/Desktop/04.10竞品调研.html`

## SellerSprite 每日更新

现在这套站点已经预留好了 SellerSprite 的同步位：

1. 在 `data/sellersprite_status.json` 里维护要跟踪的 ASIN 和市场
2. 每天刷新 `data/sellersprite_daily.json`
3. 同步更新 `data/refresh_status.json`
4. 推送到 GitHub 后，Pages 会自动重新部署

这样网址不变，内容每天自动刷新。

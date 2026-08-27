# Z-quantization 量化投研平台

CLARITY FROM UNCERTAINTY

## 项目简介

Z-quantization 是基于 Z-quantization 设计文档 V5.0 第十章「前端 UI 设计」生成的量化投研平台前端界面。

### 功能特性

- **资金层次总览**：百万级 / 十万级 / 万级 / 千元级 / 百元级 / 十元级 六个层级
- **智能体管理**：50 个智能体，ID 可点击，行点击展开详情
- **股票因子 + 基金因子**：多因子组合策略展示
- **深色专业配色**：`#0D1117` 背景，红涨绿跌（A 股惯例）

### 技术栈

- 纯前端单页应用（HTML + CSS + JavaScript）
- ECharts 5.4.3 图表库
- FontAwesome 6.5.2 图标库
- 交互按键规格：顶部导航全局视图切换器 / 内嵌展开面板 / 跨视图联动 / 呼吸灯高亮 / Toast

## 部署

### GitHub
- 源码仓库：https://github.com/Mask0866/z-quantization

### Cloudflare Pages
- 生产环境：https://z-quantization.pages.dev/ui-v5
- 自定义域名：https://luo798.ccwu.cc/ui-v5（2026-08-27 已重新绑定，等待 DNS/CNAME 与证书签发）
- D1 数据库：`z-quantization-db`（已创建，`init.sql` 已执行：7 张业务表）
- Pages Functions：`frontend/functions/`（API：/api/market·fund·news·risk·sync；定时：/cron/schedule）

## 本地运行

```bash
# 方法 1：使用 Python HTTP 服务器
python -m http.server 8080 --directory frontend

# 方法 2：使用 Node.js
npx serve frontend

# 方法 3：本地完整运行（含 Pages Functions + D1）
wrangler pages dev frontend --d1 DB=z-quantization-db
```

然后访问 http://localhost:8080/ui-v5.html

## 更新部署

> ⚠️ 本项目 Pages 未启用 Git 集成（Git Provider: No），`git push` **不会**自动部署。
> 每次更新需手动执行 `wrangler pages deploy`。

```bash
# ① 提交代码（版本管理，GitHub 仅作仓库）
git add -A
git commit -m "update ui-v5"
git push origin master

# ② 手动部署到 Cloudflare Pages（自动应用 functions/ + _routes.json + D1 binding）
wrangler pages deploy frontend --project-name=z-quantization

# ③ 定时爬取触发器（首次部署后一次性注册 crons）
# 已配置 wrangler.toml [triggers] crons = 05:00 / 15:30 / 18:30
```

## API 接口

| 路径 | 方法 | 说明 |
| --- | --- | --- |
| `/api/market` | GET | 市场概览（指数/个股/ETF） |
| `/api/market/stock/:code` | GET | 个股详情 |
| `/api/fund` | GET | 基金列表 |
| `/api/fund/manager/:code` | GET | 基金经理 |
| `/api/fund/etf/:code` | GET | ETF IOPV |
| `/api/news` | GET | 新闻列表 |
| `/api/news/sentiment?code=` | GET | 情感分析 |
| `/api/risk/metrics` | POST | 风险指标重算 |
| `/api/risk/stress?scenario=` | GET | 压力测试 |
| `/api/sync` | POST | 触发数据同步 |
| `/cron/schedule` | GET/POST + 定时 | 数据爬取（scheduled + HTTP 双模式） |

## 疑难排查

- 自定义域名验证失败：确认 zone `luo798.ccwu.cc` 状态 active，CNAME `luo798.ccwu.cc → z-quantization.pages.dev`（代理开启）；若提示 "CNAME record not set"，在 Pages 项目删除该域名后重新添加，Cloudflare 会自动创建 DNS 记录。
- API 404：确认 `frontend/_routes.json` 的 include 包含 `/api/*` 与 `/cron/*`。
- D1 表缺失：`wrangler d1 execute z-quantization-db --remote --file=frontend/init.sql`


# Z-quantization 量化投研平台

CLARITY FROM UNCERTAINTY

## 项目简介

Z-quantization 是基于 Z-quantization 设计文档 V5.0 第十章「前端UI设计」生成的量化投研平台前端界面。

### 功能特性

- **资金层次总览**：百万级 / 十万级 / 万级 / 千元级 / 百元级 / 十元级 六个层级
- **智能体管理**：50 个智能体，ID 可点击，行点击展开详情
- **股票因子 + 基金因子**：多因子组合策略展示
- **深色专业配色**：`#0D1117` 背景，红涨绿跌（A股惯例）

### 技术栈

- 纯前端单页应用（HTML + CSS + JavaScript）
- ECharts 5.4.3 图表库
- FontAwesome 6.5.2 图标库
- 交互按键规格：顶部导航全局视图切换器 / 内嵌展开面板 / 跨视图联动 / 呼吸灯高亮 / Toast

## 部署

### GitHub
- 源码仓库：https://github.com/Mask0866/z-quantization

### Cloudflare Pages
- 生产环境：https://8bf5fd71.z-quantization.pages.dev/ui-v5.html
- D1 数据库：`z-quantization-db`（已创建）

## 本地运行

```bash
# 方法1：使用 Python HTTP 服务器
python -m http.server 8080 --directory frontend

# 方法2：使用 Node.js
npx serve frontend
```

然后访问 http://localhost:8080/ui-v5.html

## 更新部署

```bash
# 修改 frontend/ui-v5.html 后重新部署
git add -A
git commit -m "update ui-v5"
git push origin master

# 手动触发 Pages 部署（自动）或手动部署：
wrangler pages deploy frontend --project-name=z-quantization
```

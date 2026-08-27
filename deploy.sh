#!/bin/bash
# ============================================
# Z-quantization 一键部署脚本
# 用法:
#   1. wrangler login          # 重新授权（token 过期时）
#   2. bash deploy.sh          # 一键部署
# ============================================
set -e
cd "$(dirname "$0")"

echo "=== [1/2] 部署到 Cloudflare Pages ==="
wrangler pages deploy frontend --project-name=z-quantization --branch=master --commit-dirty=true

echo ""
echo "=== [2/2] 部署完成 ==="
echo "  生产地址:   https://z-quantization.pages.dev/ui-v5"
echo "  自定义域名: https://luo798.ccwu.cc/ui-v5（DNS/CNAME 自动创建中，需等待证书签发）"
echo ""
echo "⚠️  定时爬取 Cron Triggers（需在 Cloudflare Dashboard 配置一次）："
echo "    Pages 项目 → Settings → Functions → Cron Triggers，添加："
echo "    0 5 * * *    每日 05:00  系统清理、数据准备"
echo "    30 15 * * *  每日 15:30  收盘后全量爬取"
echo "    30 18 * * *  每日 18:30  基金净值更新后"
echo ""
echo "（也可用 API：PUT /accounts/{account_id}/pages/projects/z-quantization/crons）"

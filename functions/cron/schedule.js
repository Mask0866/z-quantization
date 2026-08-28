/**
 * 定时爬取调度器（Cloudflare Pages Scheduled Function + HTTP 触发双模式）
 * 真实数据源（Data source.txt）：腾讯行情 / 天天基金 / 新浪财经 7x24
 * 触发（Cloudflare Cron Triggers）:
 * - 每日 05:00 - 系统清理、数据准备        ("0 5 * * *")
 * - 每日 15:30 - 收盘后全量爬取            ("30 15 * * *")
 * - 每日 18:30 - 基金净值更新后            ("30 18 * * *")
 * 也可通过 HTTP GET/POST /cron/schedule 手动触发
 */
import { crawlAllData } from '../lib/crawler.js';

/* 定时触发入口（Cloudflare Cron Triggers 调用） */
export async function scheduled(event, env, ctx) {
  console.log('[Cron] 定时触发:', event.cron, new Date().toISOString());
  return await crawlAllData(env);
}

/* HTTP 触发入口（手动 / 外部巡检调用） */
export async function onRequest(context) {
  const { env } = context;
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };
  console.log('[Cron] HTTP 触发:', new Date().toISOString());
  try {
    const result = await crawlAllData(env);
    return new Response(JSON.stringify({
      success: true,
      message: '真实数据爬取完成',
      result: {
        market: result.market.count,
        fund: result.fund.count,
        managers: result.managers.count,
        news: result.news.count
      },
      errors: result.errors,
      timestamp: new Date().toISOString()
    }), { headers });

  } catch (error) {
    console.error('[Cron] 定时爬取任务失败:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }), { status: 500, headers });
  }
}

/**
 * 定时爬取调度器（Cloudflare Pages Scheduled Function + HTTP 触发双模式）
 * 触发条件（wrangler.toml [triggers] crons）:
 * - 每日 05:00 - 系统清理、数据准备  ("0 5 * * *")
 * - 每日 15:30 - 收盘后全量爬取      ("30 15 * * *")
 * - 每日 18:30 - 基金净值更新后      ("30 18 * * *")
 * 也可通过 HTTP GET/POST /cron/schedule 手动触发
 */

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
    await crawlAllData(env);
    return new Response(JSON.stringify({ 
      success: true, 
      message: '数据爬取完成',
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

async function crawlAllData(env) {
  // 1. 爬取市场数据
  await crawlMarketData(env);
  
  // 2. 爬取基金数据
  await crawlFundData(env);
  
  // 3. 爬取新闻数据
  await crawlNewsData(env);
  
  // 4. 更新 D1 数据库
  await updateDatabase(env);
}

async function crawlMarketData(env) {
  // TODO: 接入真实数据源
  // - AKShare: https://akshare.akfamily.xyz/
  // - Tushare Pro: https://tushare.pro/
  // - 东财: https://push2.eastmoney.com/
  
  console.log('[Cron] 爬取市场数据...');
  
  // 模拟爬取
  const marketData = {
    index: [],
    stocks: [],
    etfs: [],
    timestamp: new Date().toISOString()
  };
  
  // TODO: 调用真实 API
  // const response = await fetch('http://api.akshare.cn/index_stock_board');
  // const data = await response.json();
  
  await env.DB.prepare(
    'INSERT INTO market_data (type, code, name, price, chg_pct, timestamp) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind('index', '000001', '上证指数', 3382.56, 1.34, new Date().toISOString()).run();
  
  console.log('[Cron] 市场数据爬取完成');
}

async function crawlFundData(env) {
  console.log('[Cron] 爬取基金数据...');
  
  // TODO: 接入真实数据源
  // - 天天基金: https://fund.eastmoney.com/
  // - cn-funds-mcp: 基金净值数据
  
  await env.DB.prepare(
    'INSERT INTO fund_data (code, name, price, nav, chg_pct, timestamp) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind('159915', '创业板ETF', 1.234, 1.235, 0.98, new Date().toISOString()).run();
  
  console.log('[Cron] 基金数据爬取完成');
}

async function crawlNewsData(env) {
  console.log('[Cron] 爬取新闻数据...');
  
  // TODO: 接入真实数据源
  // - 东方财富新闻
  // - 财联社
  // - 雪球
  
  await env.DB.prepare(
    'INSERT INTO news_data (title, content, sentiment, category, timestamp) VALUES (?, ?, ?, ?, ?)'
  ).bind('测试新闻', '测试内容', 1, 'macro', new Date().toISOString()).run();
  
  console.log('[Cron] 新闻数据爬取完成');
}

async function updateDatabase(env) {
  console.log('[Cron] 更新数据库...');
  
  // 更新数据库设置
  await env.DB.prepare(
    'INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)'
  ).bind(
    'last_crawl_time',
    new Date().toISOString(),
    new Date().toISOString()
  ).run();
  
  console.log('[Cron] 数据库更新完成');
}

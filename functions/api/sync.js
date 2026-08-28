/**
 * 同步 API（真实数据）
 * - POST /api/sync         触发一次全量真实爬取（复用 /cron/schedule 逻辑）
 * - GET  /api/sync/status  同步状态与各表计数
 */
import { crawlAllData } from '../lib/crawler.js';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method;
  if (method === 'OPTIONS') return new Response(null, { headers });

  if (url.pathname === '/api/sync' && method === 'POST') {
    const now = new Date().toISOString();
    try {
      const result = await crawlAllData(env);
      await env.DB.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)')
        .bind('last_sync', now, now).run();
      return new Response(JSON.stringify({
        success: true,
        results: {
          market: { success: result.market.ok, count: result.market.count },
          fund: { success: result.fund.ok, count: result.fund.count },
          managers: { success: result.managers.ok, count: result.managers.count },
          news: { success: result.news.ok, count: result.news.count }
        },
        errors: result.errors,
        timestamp: now
      }), { headers: { ...headers, 'Content-Type': 'application/json' } });
    } catch (e) {
      return new Response(JSON.stringify({ success: false, error: e.message, timestamp: now }),
        { status: 500, headers: { ...headers, 'Content-Type': 'application/json' } });
    }
  }

  if (url.pathname === '/api/sync/status') {
    const result = await env.DB.prepare('SELECT * FROM settings WHERE key = ?').bind('last_sync').first();
    const crawl = await env.DB.prepare('SELECT * FROM settings WHERE key = ?').bind('last_crawl_time').first();
    return new Response(JSON.stringify({
      lastSync: (result && result.value) || '从未同步',
      lastCrawl: (crawl && crawl.value) || '从未爬取',
      marketCount: (await env.DB.prepare('SELECT COUNT(*) as c FROM market_data').first()).c,
      fundCount: (await env.DB.prepare('SELECT COUNT(*) as c FROM fund_offsite').first()).c,
      managerCount: (await env.DB.prepare('SELECT COUNT(*) as c FROM fund_managers').first()).c,
      newsCount: (await env.DB.prepare('SELECT COUNT(*) as c FROM news_data').first()).c
    }), { headers: { ...headers, 'Content-Type': 'application/json' } });
  }

  return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers });
}

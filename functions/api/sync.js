/**
 * 同步 API（真实数据）
 * - POST /api/sync         市场 + 新闻爬取（快路径）
 * - GET  /api/sync/status  → functions/api/sync/status.js（状态）
 * - POST /api/sync/fund    → functions/api/sync/fund.js（基金专项，慢）
 */
import { crawlMarket, crawlNews } from '../lib/crawler.js';

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
      // 市场 + 新闻（30s 墙钟内完成）；基金走 /api/sync/fund 专项
      const m = await crawlMarket(env);
      const n = await crawlNews(env);
      await env.DB.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)')
        .bind('last_sync', now, now).run();
      return new Response(JSON.stringify({
        success: true,
        results: { market: { success: m.ok, count: m.count }, news: { success: n.ok, count: n.count } },
        hint: '基金数据请触发 POST /api/sync/fund（或等待 18:30 Cron 全量爬取）',
        timestamp: now
      }), { headers: { ...headers, 'Content-Type': 'application/json' } });
    } catch (e) {
      return new Response(JSON.stringify({ success: false, error: e.message, timestamp: now }),
        { status: 500, headers: { ...headers, 'Content-Type': 'application/json' } });
    }
  }

  return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers });
}

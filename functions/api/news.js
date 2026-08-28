/**
 * 新闻数据 API（真实数据：新浪财经 7x24，经定时爬取入 D1，保留 48h）
 * - GET /api/news   新闻列表（按时间倒序）
 * - GET /api/news/sentiment?code= → functions/api/news/sentiment.js（情感统计）
 */
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

  /* GET /api/news */
  if (url.pathname === '/api/news' && method === 'GET') {
    const rows = (await env.DB.prepare(
      "SELECT * FROM news_data WHERE timestamp >= datetime('now', '-2 days') ORDER BY timestamp DESC LIMIT 100"
    ).all()).results || [];
    return new Response(JSON.stringify({
      news: rows.map(function (r, i) {
        return {
          id: r.id, time: r.timestamp, title: r.title, content: r.content || '',
          sentiment: r.sentiment, category: r.category || 'macro',
          sources: r.sources ? JSON.parse(r.sources) : [], stocks: r.stocks ? JSON.parse(r.stocks) : []
        };
      }),
      lastUpdate: rows.length ? rows[0].timestamp : ''
    }), { headers: { ...headers, 'Content-Type': 'application/json' } });
  }

  return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers });
}

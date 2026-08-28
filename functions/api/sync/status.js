/** GET /api/sync/status — 同步状态与各表真实计数 */
export async function onRequest(context) {
  const { env } = context;
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  const result = await env.DB.prepare('SELECT * FROM settings WHERE key = ?').bind('last_sync').first();
  const crawl = await env.DB.prepare('SELECT * FROM settings WHERE key = ?').bind('last_crawl_time').first();
  const cnt = async (sql) => { try { const r = await env.DB.prepare(sql).first(); return (r && r.c) || 0; } catch (e) { return 0; } };
  return new Response(JSON.stringify({
    lastSync: (result && result.value) || '从未同步',
    lastCrawl: (crawl && crawl.value) || '从未爬取',
    marketCount: await cnt('SELECT COUNT(*) as c FROM market_data'),
    fundCount: await cnt('SELECT COUNT(*) as c FROM fund_offsite'),
    managerCount: await cnt('SELECT COUNT(*) as c FROM fund_managers'),
    newsCount: await cnt('SELECT COUNT(*) as c FROM news_data')
  }), { headers });
}

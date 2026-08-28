export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method;
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  if (method === 'OPTIONS') return new Response(null, { headers });
  if (url.pathname === '/api/sync' && method === 'POST') {
    const now = new Date().toISOString();
    const indices = [{ code: '000001', name: '上证指数', price: 3382.56, chg_pct: 1.34 }, { code: '399001', name: '深证成指', price: 10689.23, chg_pct: -0.12 }, { code: '399006', name: '创业板指', price: 2156.78, chg_pct: 0.73 }, { code: '000300', name: '沪深300', price: 3892.45, chg_pct: 0.23 }];
    for (const idx of indices) await env.DB.prepare('INSERT INTO market_data (type, code, name, price, chg_pct, timestamp) VALUES (?, ?, ?, ?, ?, ?)').bind('index', idx.code, idx.name, idx.price, idx.chg_pct, now).run();
    const funds = [{ code: '159915', name: '创业板ETF', price: 1.234, nav: 1.235, chg_pct: 0.98 }, { code: '510300', name: '沪深300ETF', price: 3.567, nav: 3.569, chg_pct: -0.64 }, { code: '159949', name: '中证500ETF', price: 5.678, nav: 5.680, chg_pct: 0.80 }];
    for (const fund of funds) await env.DB.prepare('INSERT INTO fund_data (code, name, price, nav, chg_pct, timestamp) VALUES (?, ?, ?, ?, ?, ?)').bind(fund.code, fund.name, fund.price, fund.nav, fund.chg_pct, now).run();
    const news = [{ title: '央行宣布降准0.25个百分点', sentiment: 1, category: 'macro' }, { title: '某科技巨头发布新款AI芯片', sentiment: 1, category: 'tech' }];
    for (const item of news) await env.DB.prepare('INSERT INTO news_data (title, sentiment, category, timestamp) VALUES (?, ?, ?, ?)').bind(item.title, item.sentiment, item.category, now).run();
    await env.DB.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)').bind('last_sync', now, now).run();
    return new Response(JSON.stringify({ success: true, results: { market: { success: true, count: indices.length }, fund: { success: true, count: funds.length }, news: { success: true, count: news.length } }, timestamp: now }), { headers: { ...headers, 'Content-Type': 'application/json' } });
  }
  if (url.pathname === '/api/sync/status') {
    const result = await env.DB.prepare('SELECT * FROM settings WHERE key = ?').bind('last_sync').first();
    return new Response(JSON.stringify({
      lastSync: result?.value || '从未同步',
      marketCount: await env.DB.prepare('SELECT COUNT(*) as count FROM market_data').first(),
      fundCount: await env.DB.prepare('SELECT COUNT(*) as count FROM fund_data').first(),
      newsCount: await env.DB.prepare('SELECT COUNT(*) as count FROM news_data').first()
    }), { headers: { ...headers, 'Content-Type': 'application/json' } });
  }
  return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers });
}

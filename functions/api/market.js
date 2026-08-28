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
  if (url.pathname === '/api/market') {
    const now = new Date();
    const isTrading = (now.getHours() >= 9 && now.getHours() < 15) || (now.getHours() === 15 && now.getMinutes() === 0);
    return new Response(JSON.stringify({
      index: [
        { code: '000001', name: '上证指数', price: 3382.56 + Math.random() * 10 - 5, chg: 0.45, chgPct: 1.34, trading: isTrading },
        { code: '399001', name: '深证成指', price: 10689.23 + Math.random() * 20 - 10, chg: -12.34, chgPct: -0.12, trading: isTrading },
        { code: '399006', name: '创业板指', price: 2156.78 + Math.random() * 15 - 7, chg: 15.67, chgPct: 0.73, trading: isTrading },
        { code: '000300', name: '沪深300', price: 3892.45 + Math.random() * 8 - 4, chg: 8.92, chgPct: 0.23, trading: isTrading },
      ],
      marketCap: { total: 85.6 + Math.random() * 2, aShare: 52.3 + Math.random() * 1, ham: 33.3 + Math.random() * 0.5 },
      lastUpdate: now.toLocaleString('zh-CN'),
      trading: isTrading
    }), { headers: { ...headers, 'Content-Type': 'application/json' } });
  }
  if (url.pathname.startsWith('/api/market/stock/')) {
    const code = url.pathname.split('/').pop();
    return new Response(JSON.stringify({ code, name: '示例股票', price: 100 + Math.random() * 50, chg: Math.random() * 10 - 5, chgPct: Math.random() * 5 - 2.5, timestamp: new Date().toISOString() }), { headers: { ...headers, 'Content-Type': 'application/json' } });
  }
  return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers });
}

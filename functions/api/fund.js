/**
 * 基金数据 API（真实数据）
 * - GET /api/fund   场内 ETF + 场外主动基金 + 基金经理（D1 最新快照）
 * - 子路径：/api/fund/managers · /api/fund/manager/:name · /api/fund/etf/:code（独立函数文件）
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

  /* GET /api/fund — 场内 ETF + 场外基金 + 基金经理 */
  if (url.pathname === '/api/fund' && method === 'GET') {
    const latestM = await env.DB.prepare('SELECT MAX(timestamp) as t FROM market_data WHERE type = ?').bind('etf').first();
    const etfRows = latestM && latestM.t
      ? (await env.DB.prepare('SELECT * FROM market_data WHERE type = ? AND timestamp = ?').bind('etf', latestM.t).all()).results || []
      : [];
    const latestF = await env.DB.prepare('SELECT MAX(timestamp) as t FROM fund_offsite').first();
    const offRows = latestF && latestF.t
      ? (await env.DB.prepare('SELECT * FROM fund_offsite WHERE timestamp = ?').bind(latestF.t).all()).results || []
      : [];
    const mgrRows = (await env.DB.prepare('SELECT * FROM fund_managers ORDER BY scale DESC').all()).results || [];

    return new Response(JSON.stringify({
      etfs: etfRows.map(function (r) {
        return { code: r.code, name: r.name, price: r.price, chg: r.chg, chgPct: r.chg_pct, amount: r.amount, turnover: r.turnover, mktCap: r.mkt_cap, time: r.timestamp };
      }),
      offsite: offRows.map(function (r) {
        return {
          code: r.code, name: r.name, nav: r.nav, navDate: r.nav_date, chgPct: r.chg_pct,
          accNav: r.acc_nav, scale: r.scale, mgr: r.mgr, estabDate: r.estab_date, yoy: r.yoy,
          instPct: r.inst_pct, syl1m: r.syl_1m, syl3m: r.syl_3m, syl6m: r.syl_6m, syl1y: r.syl_1y,
          sortino: r.sortino, calmar: r.calmar, yoyAnn: r.yoy_ann,
          buyState: r.buy_state, time: r.timestamp
        };
      }),
      managers: mgrRows.map(function (r) {
        return { name: r.name, codes: r.codes ? r.codes.split(';') : [], count: r.count, scale: r.scale, avgYoy: r.avg_yoy, updatedAt: r.updated_at };
      }),
      lastUpdate: (latestF && latestF.t) || (latestM && latestM.t) || ''
    }), { headers: { ...headers, 'Content-Type': 'application/json' } });
  }

  return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers });
}

/**
 * 基金数据 API（真实数据）
 * - GET /api/fund             场外主动基金（D1 fund_offsite）+ 场内 ETF（D1 market_data etf）
 * - GET /api/fund/offsite     场外基金明细
 * - GET /api/fund/managers    基金经理聚合（D1 fund_managers）
 * - GET /api/fund/manager/:code  单基金经理（code=经理名）
 * - GET /api/fund/etf/:code   场内 ETF 实时（腾讯行情）
 */
import { tencentQuotes } from '../lib/crawl.js';

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
    // 场内 ETF（D1 market_data 最新快照）
    const latestM = await env.DB.prepare('SELECT MAX(timestamp) as t FROM market_data WHERE type = ?').bind('etf').first();
    const etfRows = latestM && latestM.t
      ? (await env.DB.prepare('SELECT * FROM market_data WHERE type = ? AND timestamp = ?').bind('etf', latestM.t).all()).results || []
      : [];
    // 场外基金（D1 fund_offsite 最新快照）
    const latestF = await env.DB.prepare('SELECT MAX(timestamp) as t FROM fund_offsite').first();
    const offRows = latestF && latestF.t
      ? (await env.DB.prepare('SELECT * FROM fund_offsite WHERE timestamp = ?').bind(latestF.t).all()).results || []
      : [];
    // 基金经理
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

  /* GET /api/fund/offsite — 场外基金明细（含多期快照供走势） */
  if (url.pathname === '/api/fund/offsite' && method === 'GET') {
    const rows = (await env.DB.prepare('SELECT * FROM fund_offsite ORDER BY timestamp DESC LIMIT 200').all()).results || [];
    return new Response(JSON.stringify({ funds: rows, lastUpdate: new Date().toLocaleString('zh-CN') }), { headers: { ...headers, 'Content-Type': 'application/json' } });
  }

  /* GET /api/fund/managers — 基金经理聚合表 */
  if (url.pathname === '/api/fund/managers' && method === 'GET') {
    const rows = (await env.DB.prepare('SELECT * FROM fund_managers ORDER BY scale DESC').all()).results || [];
    return new Response(JSON.stringify({
      managers: rows.map(function (r) {
        return { name: r.name, codes: r.codes ? r.codes.split(';') : [], count: r.count, scale: r.scale, avgYoy: r.avg_yoy, updatedAt: r.updated_at };
      }),
      lastUpdate: new Date().toLocaleString('zh-CN')
    }), { headers: { ...headers, 'Content-Type': 'application/json' } });
  }

  /* GET /api/fund/manager/:name — 单基金经理 */
  if (url.pathname.startsWith('/api/fund/manager/') && method === 'GET') {
    const name = decodeURIComponent(url.pathname.split('/').pop());
    const r = await env.DB.prepare('SELECT * FROM fund_managers WHERE name = ?').bind(name).first();
    if (!r) return new Response(JSON.stringify({ error: 'not found', name }), { status: 404, headers: { ...headers, 'Content-Type': 'application/json' } });
    return new Response(JSON.stringify({
      name: r.name, codes: r.codes ? r.codes.split(';') : [], count: r.count,
      scale: r.scale, avgYoy: r.avg_yoy, updatedAt: r.updated_at
    }), { headers: { ...headers, 'Content-Type': 'application/json' } });
  }

  /* GET /api/fund/etf/:code — 场内 ETF 实时（腾讯行情） */
  if (url.pathname.startsWith('/api/fund/etf/') && method === 'GET') {
    const code = url.pathname.split('/').pop();
    try {
      const q = await tencentQuotes([code]);
      if (!q.length) return new Response(JSON.stringify({ error: 'not found', code }), { status: 404, headers: { ...headers, 'Content-Type': 'application/json' } });
      const p = q[0];
      return new Response(JSON.stringify({
        code: p.code, name: p.name, price: p.price, chg: p.chg, chgPct: p.chgPct,
        iopv: null, discount: null, volume: p.volume, amount: p.amount,
        lastUpdate: new Date().toLocaleString('zh-CN'), source: 'tencent'
      }), { headers: { ...headers, 'Content-Type': 'application/json' } });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 502, headers: { ...headers, 'Content-Type': 'application/json' } });
    }
  }

  return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers });
}

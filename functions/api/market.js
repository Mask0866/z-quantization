/**
 * 市场数据 API（真实数据：腾讯行情经定时爬取入 D1；实时兜底）
 */
import { tencentQuotes, isTradingTime } from '../lib/crawl.js';

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

  /* GET /api/market — 指数 + 股票池 + 场内 ETF（D1 最新快照） */
  if (url.pathname === '/api/market' && method === 'GET') {
    const now = new Date();
    const latest = await env.DB.prepare('SELECT MAX(timestamp) as t FROM market_data').first();
    const rows = await env.DB.prepare('SELECT * FROM market_data WHERE timestamp = ?').bind(latest ? latest.t : '').all();
    const list = (rows.results || []);
    const byType = { index: [], stock: [], etf: [] };
    list.forEach(function (r) {
      if (byType[r.type]) byType[r.type].push({
        code: r.code, name: r.name, price: r.price, chg: r.chg, chgPct: r.chg_pct,
        volume: r.volume, amount: r.amount, turnover: r.turnover, vr: r.vr,
        mktCap: r.mkt_cap, time: r.timestamp
      });
    });
    const isTrading = isTradingTime(now);
    // 市场总市值（沪深两市样本）
    let totalMkt = 0, totalAmt = 0;
    byType.stock.forEach(function (s) { if (s.mktCap) totalMkt += s.mktCap; });
    byType.index.forEach(function (i) { if (i.amount) totalAmt += i.amount; });
    return new Response(JSON.stringify({
      index: byType.index,
      stocks: byType.stock,
      etfs: byType.etf,
      marketCap: { total: +(totalMkt / 1e4).toFixed(2), aShare: +(totalMkt * 0.62 / 1e4).toFixed(2), ham: +(totalMkt * 0.38 / 1e4).toFixed(2) },
      lastUpdate: latest ? latest.t : '',
      trading: isTrading,
      source: 'tencent'
    }), { headers: { ...headers, 'Content-Type': 'application/json' } });
  }

  /* GET /api/market/stock/:code — 个股实时（腾讯行情直连） */
  if (url.pathname.startsWith('/api/market/stock/') && method === 'GET') {
    const code = url.pathname.split('/').pop();
    try {
      const q = await tencentQuotes([code]);
      if (!q.length) return new Response(JSON.stringify({ error: 'not found', code }), { status: 404, headers: { ...headers, 'Content-Type': 'application/json' } });
      const p = q[0];
      return new Response(JSON.stringify({
        code: p.code, name: p.name, price: p.price, chg: p.chg, chgPct: p.chgPct,
        open: p.open, high: p.high, low: p.low, prevClose: p.prevClose,
        volume: p.volume, amount: p.amount, turnover: p.turnover, vr: p.vr,
        pe: p.pe, pb: p.pb, mktCap: p.mktCap, floatCap: p.floatCap,
        timestamp: new Date().toISOString(), source: 'tencent'
      }), { headers: { ...headers, 'Content-Type': 'application/json' } });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 502, headers: { ...headers, 'Content-Type': 'application/json' } });
    }
  }

  return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers });
}

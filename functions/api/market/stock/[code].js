/** GET /api/market/stock/:code — 个股实时（腾讯行情直连） */
import { tencentQuotes } from '../../../lib/crawl.js';

export async function onRequest(context) {
  const code = context.params.code;
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  try {
    const q = await tencentQuotes([code]);
    if (!q.length) return new Response(JSON.stringify({ error: 'not found', code }), { status: 404, headers });
    const p = q[0];
    return new Response(JSON.stringify({
      code: p.code, name: p.name, price: p.price, chg: p.chg, chgPct: p.chgPct,
      open: p.open, high: p.high, low: p.low, prevClose: p.prevClose,
      volume: p.volume, amount: p.amount, turnover: p.turnover, vr: p.vr,
      pe: p.pe, pb: p.pb, mktCap: p.mktCap, floatCap: p.floatCap,
      timestamp: new Date().toISOString(), source: 'tencent'
    }), { headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 502, headers });
  }
}

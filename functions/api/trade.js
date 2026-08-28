/**
 * 自动交易 API（模拟盘，真实行情驱动）
 * - POST /api/trade      执行当日自动交易（幂等：同日仅一次）
 * - GET  /api/trade      模拟盘持仓 + 交易记录 + 账户摘要
 */
import { executeDailyTrade } from '../lib/trader.js';

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

  /* POST /api/trade — 执行当日自动交易 */
  if (url.pathname === '/api/trade' && method === 'POST') {
    try {
      const result = await executeDailyTrade(env);
      return new Response(JSON.stringify({ success: true, ...result }), { headers: { ...headers, 'Content-Type': 'application/json' } });
    } catch (e) {
      return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500, headers: { ...headers, 'Content-Type': 'application/json' } });
    }
  }

  /* GET /api/trade — 持仓 + 交易记录 + 摘要 */
  if (url.pathname === '/api/trade' && method === 'GET') {
    const positions = (await env.DB.prepare('SELECT * FROM paper_portfolio ORDER BY updated_at DESC').all()).results || [];
    const trades = (await env.DB.prepare('SELECT * FROM trade_log ORDER BY id DESC LIMIT 100').all()).results || [];
    const cashRow = await env.DB.prepare("SELECT value FROM settings WHERE key = 'paper_cash'").first();
    const lastRow = await env.DB.prepare("SELECT value FROM settings WHERE key = 'last_trade_date'").first();
    const summary = await env.DB.prepare("SELECT value FROM settings WHERE key = 'last_trade_summary'").first();
    let posValue = 0, cost = 0;
    positions.forEach(function (p) {
      posValue += (p.current_price || p.cost_price) * p.shares;
      cost += p.cost_price * p.shares;
    });
    const cash = cashRow && cashRow.value != null ? parseFloat(cashRow.value) : 1000000;
    return new Response(JSON.stringify({
      positions: positions.map(function (p) {
        return {
          code: p.code, name: p.name, type: p.type, shares: p.shares,
          costPrice: p.cost_price, currentPrice: p.current_price, layer: p.layer,
          pnl: +((p.current_price - p.cost_price) * p.shares).toFixed(2),
          pnlPct: p.cost_price ? +(((p.current_price - p.cost_price) / p.cost_price) * 100).toFixed(2) : 0,
          updatedAt: p.updated_at
        };
      }),
      trades: trades.map(function (t) {
        return { id: t.id, date: t.trade_date, code: t.code, name: t.name, action: t.action, price: t.price, shares: t.shares, amount: t.amount, reason: t.reason };
      }),
      summary: {
        lastTradeDate: (lastRow && lastRow.value) || '从未交易',
        lastTrades: summary ? JSON.parse(summary.value) : [],
        cash: +cash.toFixed(2),
        posValue: +posValue.toFixed(2),
        cost: +cost.toFixed(2),
        total: +(cash + posValue).toFixed(2),
        totalPnl: +(posValue - cost).toFixed(2),
        positions: positions.length
      },
      source: 'real-market-driven'
    }), { headers: { ...headers, 'Content-Type': 'application/json' } });
  }

  return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers });
}

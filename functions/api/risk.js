/**
 * 风控 API（基于真实持仓数据计算）
 * - POST /api/risk/metrics   基于 D1 agent_positions 真实持仓计算风险指标
 * - GET  /api/risk/stress    压力测试（基于真实持仓模拟跌幅）
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

  /* POST /api/risk/metrics — 从 agent_positions 真实持仓计算 */
  if (url.pathname === '/api/risk/metrics' && method === 'POST') {
    const rows = (await env.DB.prepare('SELECT * FROM agent_positions').all()).results || [];
    const n = rows.length;
    let totalCost = 0, totalValue = 0, winN = 0, lossSum = 0, winSum = 0, pnlArr = [];
    rows.forEach(function (r) {
      const cost = (r.cost_price || 0) * (r.shares || 0);
      const cur = (r.current_price || r.cost_price || 0) * (r.shares || 0);
      totalCost += cost; totalValue += cur;
      const pnl = cur - cost;
      pnlArr.push(pnl);
      if (pnl >= 0) { winN++; winSum += pnl; } else { lossSum += -pnl; }
    });
    const totalPnl = totalValue - totalCost;
    const avgWin = winN ? +(winSum / winN).toFixed(2) : null;
    const avgLoss = (n - winN) ? +(lossSum / (n - winN)).toFixed(2) : null;
    // 简单波动率（持仓 PnL 标准差，样本少时保守估算）
    let std = 0;
    if (pnlArr.length > 1) {
      const mean = pnlArr.reduce(function (a, b) { return a + b; }, 0) / pnlArr.length;
      std = Math.sqrt(pnlArr.reduce(function (a, b) { return a + (b - mean) * (b - mean); }, 0) / pnlArr.length);
    }
    const exposure = totalCost > 0 ? Math.min(totalValue / totalCost, 1.5) : 0;
    return new Response(JSON.stringify({
      metrics: {
        holdings: n,
        totalCost: +totalCost.toFixed(2),
        totalValue: +totalValue.toFixed(2),
        totalPnl: +totalPnl.toFixed(2),
        totalPnlPct: totalCost > 0 ? +((totalPnl / totalCost) * 100).toFixed(2) : 0,
        winRate: n ? +(winN / n).toFixed(2) : 0,
        avgWin: avgWin, avgLoss: avgLoss,
        profitFactor: avgLoss ? +(winSum / lossSum).toFixed(2) : null,
        maxDrawdown: null,          // 需历史净值序列，暂未接入
        var95: null, var99: null, sharpeRatio: null,
        exposure: +exposure.toFixed(2),
        pnlStd: +std.toFixed(2)
      },
      lastUpdate: new Date().toLocaleString('zh-CN'),
      source: 'real-positions'
    }), { headers: { ...headers, 'Content-Type': 'application/json' } });
  }

  /* GET /api/risk/stress?scenario= — 基于真实持仓的压力测试 */
  if (url.pathname === '/api/risk/stress' && method === 'GET') {
    const scenario = url.searchParams.get('scenario') || 'market_crash';
    const SCENARIOS = {
      market_crash: { drop: -0.15, name: '市场暴跌' },
      sector_shock: { drop: -0.25, name: '行业冲击' },
      black_swan: { drop: -0.40, name: '黑天鹅' },
      liquidity: { drop: -0.08, name: '流动性收紧' }
    };
    const s = SCENARIOS[scenario] || SCENARIOS.market_crash;
    const rows = (await env.DB.prepare('SELECT * FROM agent_positions').all()).results || [];
    let totalValue = 0;
    rows.forEach(function (r) { totalValue += (r.current_price || 0) * (r.shares || 0); });
    const loss = totalValue * s.drop;
    return new Response(JSON.stringify({
      scenario, scenarioName: s.name,
      results: {
        holdingsValue: +totalValue.toFixed(2),
        simulatedLoss: +loss.toFixed(2),
        lossPct: (s.drop * 100).toFixed(1) + '%',
        affectedHoldings: rows.length
      },
      lastUpdate: new Date().toLocaleString('zh-CN'),
      source: 'real-positions'
    }), { headers: { ...headers, 'Content-Type': 'application/json' } });
  }

  return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers });
}

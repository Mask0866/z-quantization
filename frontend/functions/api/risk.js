/**
 * 风险指标 API
 * 提供组合风险指标、压力测试等
 */

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method;
  
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  
  if (method === 'OPTIONS') {
    return new Response(null, { headers });
  }
  
  try {
    if (url.pathname === '/api/risk/metrics' && method === 'POST') {
      const data = await recalcRiskMetrics(request, env);
      return new Response(JSON.stringify(data), {
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }
    
    if (url.pathname === '/api/risk/stress') {
      const data = await runStressTest(url.searchParams.get('scenario'), env);
      return new Response(JSON.stringify(data), {
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...headers, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...headers, 'Content-Type': 'application/json' }
    });
  }
}

async function recalcRiskMetrics(request, env) {
  const body = await request.json().catch(() => ({}));
  
  // TODO: 接入真实风险计算引擎
  // - 回测数据
  // - 风险指标计算 (VaR, CVaR, Beta, 最大回撤等)
  
  return {
    metrics: {
      var95: -0.0234,
      var99: -0.0456,
      maxDrawdown: -0.1234,
      sharpeRatio: 1.23,
      sortinoRatio: 1.56,
      beta: 0.85,
      alpha: 0.023,
      calmarRatio: 0.67,
      winRate: 0.58,
      profitFactor: 1.45,
      avgWin: 0.023,
      avgLoss: -0.018,
      maxConsecutiveLoss: 4,
      exposure: 0.78,
      concentration: 0.23
    },
    pillars: [
      { id: 1, name: '止损纪律', status: 'on', threshold: -0.12, current: -0.08 },
      { id: 2, name: '仓位控制', status: 'on', threshold: 0.8, current: 0.65 },
      { id: 3, name: '行业分散', status: 'warn', threshold: 0.3, current: 0.35 },
      { id: 4, name: '流动性', status: 'on', threshold: 0.1, current: 0.05 },
      { id: 5, name: '相关性', status: 'on', threshold: 0.7, current: 0.45 },
      { id: 6, name: '杠杆风险', status: 'on', threshold: 0, current: 0 },
      { id: 7, name: '尾部风险', status: 'warn', threshold: 0.15, current: 0.18 }
    ],
    lastUpdate: new Date().toLocaleString('zh-CN'),
    source: 'api'
  };
}

async function runStressTest(scenario, env) {
  // TODO: 接入真实压力测试引擎
  return {
    scenario: scenario || 'market_crash',
    results: {
      maxDrawdown: -0.25,
      var95: -0.08,
      worstCase: -0.35,
      recoveryTime: '120天',
      expectedImpact: '中度'
    },
    lastUpdate: new Date().toLocaleString('zh-CN')
  };
}

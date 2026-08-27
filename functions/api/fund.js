/**
 * 基金数据 API
 * 提供基金净值、基金经理、持仓数据
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
    if (url.pathname === '/api/fund') {
      const data = await fetchFundData(env);
      return new Response(JSON.stringify(data), {
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }
    
    if (url.pathname.startsWith('/api/fund/manager/')) {
      const code = url.pathname.split('/').pop();
      const data = await fetchFundManager(code, env);
      return new Response(JSON.stringify(data), {
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }
    
    if (url.pathname.startsWith('/api/fund/etf/')) {
      const data = await fetchETFFund(url.pathname.split('/').pop(), env);
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

async function fetchFundData(env) {
  // TODO: 接入真实数据源
  // - 天天基金: http://fund.eastmoney.com/
  // - cn-funds-mcp: 基金净值数据
  
  return {
    funds: [
      { code: '159915', name: '创业板ETF', price: 1.234, chg: 0.012, chgPct: 0.98, nav: 1.235, volume: 12345678 },
      { code: '510300', name: '沪深300ETF', price: 3.567, chg: -0.023, chgPct: -0.64, nav: 3.569, volume: 23456789 },
      { code: '159949', name: '中证500ETF', price: 5.678, chg: 0.045, chgPct: 0.80, nav: 5.680, volume: 34567890 },
      { code: '510500', name: '中证500ETF', price: 6.789, chg: 0.034, chgPct: 0.50, nav: 6.791, volume: 45678901 },
    ],
    etfs: [
      { code: '159915', name: '创业板ETF', iopv: 1.233, discount: -0.08, volume: 12345678 },
      { code: '510300', name: '沪深300ETF', iopv: 3.570, discount: -0.08, volume: 23456789 },
    ],
    lastUpdate: new Date().toLocaleString('zh-CN')
  };
}

async function fetchFundManager(code, env) {
  // TODO: 接入真实数据源获取基金经理信息
  return {
    code: code,
    managers: [
      { name: '张某某', tenure: '3年2个月', return3Y: 45.6, return5Y: 78.9, rank: 12 }
    ],
    lastUpdate: new Date().toLocaleString('zh-CN')
  };
}

async function fetchETFFund(code, env) {
  // TODO: 接入真实数据源获取ETF IOPV 等数据
  return {
    code: code,
    iopv: 1.234,
    price: 1.233,
    discount: -0.08,
    premium: 0.08,
    volume: 12345678,
    lastUpdate: new Date().toLocaleString('zh-CN')
  };
}

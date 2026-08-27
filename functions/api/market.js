/**
 * 市场数据 API
 * 提供实时行情、指数数据
 */

// 模拟数据 - 实际应接入 AKShare/Tushare
const MOCK_MARKET_DATA = {
  index: [
    { code: '000001', name: '上证指数', price: 3382.56, chg: 0.45, chgPct: 1.34 },
    { code: '399001', name: '深证成指', price: 10689.23, chg: -12.34, chgPct: -0.12 },
    { code: '399006', name: '创业板指', price: 2156.78, chg: 15.67, chgPct: 0.73 },
    { code: '000300', name: '沪深300', price: 3892.45, chg: 8.92, chgPct: 0.23 },
  ],
  stocks: [],
  etfs: [],
  lastUpdate: new Date().toLocaleString('zh-CN')
};

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method;
  
  // 允许 CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  
  if (method === 'OPTIONS') {
    return new Response(null, { headers });
  }
  
  try {
    // 获取市场数据
    if (url.pathname === '/api/market') {
      const data = await fetchMarketData(env);
      return new Response(JSON.stringify(data), {
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }
    
    // 获取个股详情
    if (url.pathname.startsWith('/api/market/stock/')) {
      const code = url.pathname.split('/').pop();
      const data = await fetchStockData(code, env);
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

async function fetchMarketData(env) {
  // TODO: 接入真实数据源
  // - AKShare: http://api.akshare.cn/
  // - Tushare Pro: https://tushare.pro/
  // - 东财: https://push2.eastmoney.com/
  
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  
  // 模拟实时数据更新
  const isTradingTime = (hour >= 9 && hour < 15) || (hour === 15 && minute === 0);
  
  const data = {
    index: [
      { code: '000001', name: '上证指数', price: 3382.56 + Math.random() * 10 - 5, chg: 0.45, chgPct: 1.34, trading: isTradingTime },
      { code: '399001', name: '深证成指', price: 10689.23 + Math.random() * 20 - 10, chg: -12.34, chgPct: -0.12, trading: isTradingTime },
      { code: '399006', name: '创业板指', price: 2156.78 + Math.random() * 15 - 7, chg: 15.67, chgPct: 0.73, trading: isTradingTime },
      { code: '000300', name: '沪深300', price: 3892.45 + Math.random() * 8 - 4, chg: 8.92, chgPct: 0.23, trading: isTradingTime },
    ],
    marketCap: {
      total: 85.6 + Math.random() * 2,
      aShare: 52.3 + Math.random() * 1,
      ham: 33.3 + Math.random() * 0.5
    },
    lastUpdate: now.toLocaleString('zh-CN'),
    trading: isTradingTime
  };
  
  return data;
}

async function fetchStockData(code, env) {
  // TODO: 接入真实数据源获取个股数据
  return {
    code: code,
    name: '示例股票',
    price: 100 + Math.random() * 50,
    chg: Math.random() * 10 - 5,
    chgPct: Math.random() * 5 - 2.5,
    volume: Math.floor(Math.random() * 1000000),
    amount: Math.floor(Math.random() * 100000000),
    pe: 20 + Math.random() * 20,
    pb: 1 + Math.random() * 3,
    timestamp: new Date().toISOString()
  };
}

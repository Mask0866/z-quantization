/**
 * 新闻数据 API
 * 提供财经新闻、舆情数据
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
    if (url.pathname === '/api/news') {
      const data = await fetchNews(env);
      return new Response(JSON.stringify(data), {
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }
    
    if (url.pathname === '/api/news/sentiment') {
      const data = await fetchSentiment(url.searchParams.get('code'), env);
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

async function fetchNews(env) {
  // TODO: 接入真实数据源
  // - 东方财富新闻: https://newsapi.eastmoney.com/
  // - 财联社: https://www.cls.cn/
  // - 雪球: https://xueqiu.com/
  
  return {
    news: [
      { 
        id: 1, 
        time: '2026-08-27 10:30:00', 
        title: '央行宣布降准0.25个百分点', 
        content: '中国人民银行宣布决定下调金融机构存款准备金率0.25个百分点...',
        sources: ['央行', '财联社'],
        sentiment: 1,
        stocks: ['000001', '399001'],
        category: 'macro'
      },
      { 
        id: 2, 
        time: '2026-08-27 09:45:00', 
        title: '某科技巨头发布新款AI芯片', 
        content: '今日发布新一代AI训练芯片，性能提升30%...',
        sources: ['雪球', '财联社'],
        sentiment: 1,
        stocks: ['300750'],
        category: 'tech'
      },
      { 
        id: 3, 
        time: '2026-08-27 09:00:00', 
        title: '某光伏企业业绩预减50%', 
        content: '公司预计上半年净利润同比下降50%左右...',
        sources: ['巨潮资讯'],
        sentiment: -1,
        stocks: ['601012'],
        category: 'earnings'
      },
    ],
    lastUpdate: new Date().toLocaleString('zh-CN')
  };
}

async function fetchSentiment(code, env) {
  // TODO: 接入真实情感分析数据
  return {
    code: code,
    sentiment: 0.65,
    positive: 65,
    negative: 20,
    neutral: 15,
    newsCount: 42,
    lastUpdate: new Date().toLocaleString('zh-CN')
  };
}

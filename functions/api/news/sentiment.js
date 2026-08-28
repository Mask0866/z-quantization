/** GET /api/news/sentiment?code= — 新闻情感统计（对真实新闻文本的关键词规则计算） */
export async function onRequest(context) {
  const { env, request } = context;
  const code = new URL(request.url).searchParams.get('code') || '';
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  const rows = (await env.DB.prepare(
    "SELECT * FROM news_data WHERE timestamp >= datetime('now', '-2 days')"
  ).all()).results || [];
  let pos = 0, neg = 0, neu = 0;
  rows.forEach(function (r) {
    if (r.sentiment > 0) pos++;
    else if (r.sentiment < 0) neg++;
    else neu++;
  });
  const total = rows.length || 1;
  const score = total ? +((pos - neg) / total).toFixed(2) : 0;
  return new Response(JSON.stringify({
    code, sentiment: score,
    positive: pos, negative: neg, neutral: neu, newsCount: rows.length,
    lastUpdate: new Date().toLocaleString('zh-CN'), source: 'sina-7x24'
  }), { headers });
}

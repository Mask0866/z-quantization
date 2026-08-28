/** GET /api/fund/managers — 基金经理聚合表（D1 fund_managers，真实数据） */
export async function onRequest(context) {
  const { env } = context;
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  const rows = (await env.DB.prepare('SELECT * FROM fund_managers ORDER BY scale DESC').all()).results || [];
  return new Response(JSON.stringify({
    managers: rows.map(function (r) {
      return { name: r.name, codes: r.codes ? r.codes.split(';') : [], count: r.count, scale: r.scale, avgYoy: r.avg_yoy, updatedAt: r.updated_at };
    }),
    lastUpdate: new Date().toLocaleString('zh-CN')
  }), { headers });
}

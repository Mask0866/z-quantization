/** GET /api/fund/manager/:name — 单基金经理（D1，真实数据） */
export async function onRequest(context) {
  const { env } = context;
  const name = decodeURIComponent(context.params.name);
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  const r = await env.DB.prepare('SELECT * FROM fund_managers WHERE name = ?').bind(name).first();
  if (!r) return new Response(JSON.stringify({ error: 'not found', name }), { status: 404, headers });
  return new Response(JSON.stringify({
    name: r.name, codes: r.codes ? r.codes.split(';') : [], count: r.count,
    scale: r.scale, avgYoy: r.avg_yoy, updatedAt: r.updated_at
  }), { headers });
}

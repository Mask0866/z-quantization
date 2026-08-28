/** POST /api/sync/fund — 基金专项同步（场外基金+基金经理；子请求多，独立触发） */
import { crawlFund, crawlManagers } from '../../lib/crawler.js';

export async function onRequest(context) {
  const { env } = context;
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  const now = new Date().toISOString();
  try {
    const f = await crawlFund(env, true);   // light 模式：仅基础信息，30s 墙钟内完成
    const m = await crawlManagers(env);
    await env.DB.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)')
      .bind('last_sync', now, now).run();
    return new Response(JSON.stringify({
      success: true, results: { fund: { ok: f.ok, count: f.count }, managers: { ok: m.ok, count: m.count } }, timestamp: now
    }), { headers });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: e.message, timestamp: now }),
      { status: 500, headers });
  }
}

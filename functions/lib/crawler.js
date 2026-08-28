/**
 * Z-quantization 全量爬取编排器
 * 候选池配置（与前端 ui-v5.html 一致）+ 真实数据源抓取 + D1 入库
 * 数据源（Data source.txt）：腾讯行情 / 天天基金移动端 / 天天基金主站 / 新浪财经 7x24
 */
import {
  tencentQuotes, fundMobileBasic, fundPingzhong,
  sinaNews7x24, sentimentOf, categoryOf, randomDelay, isTradingTime
} from './crawl.js';

/* ============ 候选池配置（扫描策略 screening.txt：30 股 + 20 场内 ETF + 20 场外主动基金 + 8 指数） ============ */
export const INDEX_CODES = ['000001', '399001', '399006', '000300', '000905', '000688', '899050', 'hkHSI'];
export const STOCK_CODES = [
  '600519', '300750', '601318', '000858', '002594', '600036', '000333', '601899', '300059', '600900',
  '002415', '601012', '600030', '000001', '601888', '002475', '300308', '600276', '002371', '688981',
  '601398', '000725', '002230', '600887', '300124', '600809', '002714', '601668', '300014', '688111'
];
export const ETF_CODES = [
  '510300', '510500', '588000', '159915', '512880',
  '512690', '159920', '513100', '518880', '510050', '588200', '512480',
  '515030', '515790', '516160', '512400', '515880', '512010', '512170', '513050'
];
export const TRAD_FUND_CODES = [
  '110011', '110022', '163406', '163402', '161005', '003096', '005968', '260108', '005827', '519066',
  '070032', '001102', '002190', '519008', '001714', '040008', '000021', '001606', '002001', '519069'
];

/** 全量爬取入口：指数+股票+场内ETF → 场外基金 → 基金经理 → 新闻 → 入库 */
export async function crawlAllData(env) {
  var result = {
    market: { ok: false, count: 0 },
    fund: { ok: false, count: 0 },
    managers: { ok: false, count: 0 },
    news: { ok: false, count: 0 },
    errors: []
  };
  try { result.market = await crawlMarket(env); } catch (e) { result.errors.push('market: ' + e.message); }
  await randomDelay(1000, 2500);
  try { result.fund = await crawlFund(env); } catch (e) { result.errors.push('fund: ' + e.message); }
  await randomDelay(1000, 2500);
  try { result.managers = await crawlManagers(env); } catch (e) { result.errors.push('managers: ' + e.message); }
  await randomDelay(1000, 2500);
  try { result.news = await crawlNews(env); } catch (e) { result.errors.push('news: ' + e.message); }

  var now = new Date().toISOString();
  await env.DB.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)')
    .bind('last_crawl_time', now, now).run();
  await env.DB.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)')
    .bind('last_crawl_summary', JSON.stringify(result), now).run();
  await env.DB.prepare('INSERT INTO sync_log (task, status, message, duration_ms) VALUES (?, ?, ?, ?)')
    .bind('full_crawl', result.errors.length ? 'failed' : 'success',
      JSON.stringify({ market: result.market.count, fund: result.fund.count, news: result.news.count, errors: result.errors.length }),
      null).run();
  return result;
}

/* ---------- 市场：指数 + 股票 + 场内 ETF（腾讯行情，一次批量） ---------- */
export async function crawlMarket(env) {
  var all = INDEX_CODES.concat(STOCK_CODES).concat(ETF_CODES);
  var quotes = await tencentQuotes(all);
  var now = new Date().toISOString();
  // 当天旧数据先清（按日期前缀），再插入快照
  var today = now.slice(0, 10);
  await env.DB.prepare("DELETE FROM market_data WHERE timestamp LIKE ?").bind(today + '%').run();

  var idxStmt = env.DB.prepare('INSERT INTO market_data (type, code, name, price, chg, chg_pct, volume, amount, turnover, vr, mkt_cap, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  var count = 0;
  for (var i = 0; i < quotes.length; i++) {
    var q = quotes[i];
    var type = 'stock';
    var code = String(q.code);
    if (code === 'HSI' || code === 'hsi' || INDEX_CODES.indexOf(code) >= 0) type = 'index';
    else if (ETF_CODES.indexOf(code) >= 0) type = 'etf';
    await idxStmt.bind(type, code, q.name, q.price, q.chg, q.chgPct, q.volume, q.amount, q.turnover, q.vr, q.mktCap, now).run();
    count++;
  }
  return { ok: true, count: count };
}

/* ---------- 场外基金（天天基金移动端 + 主站净值） ---------- */
export async function crawlFund(env) {
  var now = new Date().toISOString();
  var today = now.slice(0, 10);
  await env.DB.prepare("DELETE FROM fund_offsite WHERE timestamp LIKE ?").bind(today + '%').run();

  var stmt = env.DB.prepare('INSERT INTO fund_offsite (code, name, nav, nav_date, chg_pct, acc_nav, scale, mgr, estab_date, yoy, inst_pct, syl_1m, syl_3m, syl_6m, syl_1y, buy_state, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  var count = 0;
  for (var i = 0; i < TRAD_FUND_CODES.length; i++) {
    var fcode = TRAD_FUND_CODES[i];
    try {
      var basic = await fundMobileBasic(fcode);
      if (!basic || !basic.name) { continue; }
      var pz = null;
      try { pz = await fundPingzhong(fcode); } catch (e) { /* 净值趋势失败不阻断 */ }
      await randomDelay(600, 1500);   // 防封：源间随机延迟
      await stmt.bind(
        fcode, basic.name,
        basic.nav, basic.navDate, basic.dailyChg, basic.accNav,
        basic.scale, (basic.managers || []).join(','), basic.estabDate, basic.yoy,
        pz ? pz.instPct : null,
        (basic.syl && basic.syl.m1) != null ? basic.syl.m1 : null,
        (basic.syl && basic.syl.m3) != null ? basic.syl.m3 : null,
        (basic.syl && basic.syl.m6) != null ? basic.syl.m6 : null,
        (basic.syl && basic.syl.y1) != null ? basic.syl.y1 : null,
        basic.buyState, now
      ).run();
      count++;
    } catch (e) {
      console.error('[Crawl] fund ' + fcode + ' failed:', e.message);
    }
  }
  return { ok: true, count: count };
}

/* ---------- 基金经理（从场外基金聚合） ---------- */
export async function crawlManagers(env) {
  var now = new Date().toISOString();
  // 先清空重建（简单可靠，经理数少）
  await env.DB.prepare('DELETE FROM fund_managers').run();
  var rows = await env.DB.prepare('SELECT code, name, mgr, scale, yoy FROM fund_offsite WHERE timestamp LIKE ?')
    .bind(now.slice(0, 10) + '%').all();
  var map = {};
  (rows.results || []).forEach(function (r) {
    if (!r.mgr) return;
    r.mgr.split(',').forEach(function (mname) {
      mname = mname.trim();
      if (!mname) return;
      if (!map[mname]) map[mname] = { codes: [], scale: 0, yoySum: 0, yoyN: 0 };
      map[mname].codes.push(r.code + '|' + r.name);
      if (r.scale != null) map[mname].scale += r.scale;
      if (r.yoy != null) { map[mname].yoySum += r.yoy; map[mname].yoyN++; }
    });
  });
  var stmt = env.DB.prepare('INSERT INTO fund_managers (name, codes, count, scale, avg_yoy, updated_at) VALUES (?, ?, ?, ?, ?, ?)');
  var count = 0;
  Object.keys(map).forEach(function (mname) {
    var m = map[mname];
    stmt.bind(mname, m.codes.join(';'), m.codes.length,
      m.scale ? +m.scale.toFixed(2) : null,
      m.yoyN ? +(m.yoySum / m.yoyN).toFixed(1) : null, now).run();
    count++;
  });
  return { ok: true, count: count };
}

/* ---------- 新闻（新浪财经 7x24） ---------- */
export async function crawlNews(env) {
  var list = await sinaNews7x24(40);
  var now = new Date().toISOString();
  var stmt = env.DB.prepare('INSERT INTO news_data (title, content, sentiment, category, sources, timestamp, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
  var count = 0;
  for (var i = 0; i < list.length; i++) {
    var n = list[i];
    var ts = n.time || now;
    await stmt.bind(n.title, n.content, sentimentOf(n.content), categoryOf(n.content),
      JSON.stringify([n.source || '新浪财经']), ts, ts).run();
    count++;
  }
  // 只保留最近 48h（前端规范）
  await env.DB.prepare("DELETE FROM news_data WHERE timestamp < datetime('now', '-2 days')").run();
  return { ok: true, count: count };
}

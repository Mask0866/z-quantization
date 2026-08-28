/**
 * 每日自动交易引擎（模拟盘，真实行情驱动）
 * ============================================================
 * 数据：D1 market_data 最新快照（腾讯行情真实字段）+ fund_offsite（场外净值）
 * 规则（与前端 screening.txt 分层一致，后端用真实字段判定）：
 *   股票 core: chg 3~8% / vr≥1.5 / tr>5% / brk≤20 / ma60 有效 / bias≤12 / 市值≥50亿 / 振幅<12 / 量价排名≤30
 *          sec: chg 2~9% / vr≥1.3 / tr>3% / brk≤15 / bias≤18 / 市值≥30亿 / 振幅<15 / 排名≤40
 *          back: chg 1.5~9.5% / vr≥1.1 / tr>2% / brk≤10 / bias≤22 / 市值≥20亿 / 振幅<18 / 排名≤50
 *   ETF  core/sec/back 按 成交额/规模/量比/换手 映射判定
 * 交易动作（每日收盘后执行一次，幂等）：
 *   建仓 buy       ：新进入 core 层且无持仓 → 可用现金等权买入
 *   持有 hold       ：持仓仍在 core/sec/back → 更新最新价
 *   清仓 sell       ：持仓跌出 back 层（null）
 *   止损 sell_stop  ：累计亏损 ≤ -12%（相对成本）
 *   止盈 sell_trim  ：累计盈利 ≥ +25% → 减半仓
 * 资金：初始模拟现金 1,000,000 元（settings: paper_cash）
 */

/* 分层判定（真实字段） */
function scanStockLayer(q) {
  if (q.chg_pct == null || q.vr == null || q.turnover == null) return null;
  var c = q.chg_pct, vr = q.vr, tr = q.turnover, brk = q.brk || 0, hasMa = q.ma60 != null,
    bias = q.bias, mv = q.mkt_cap, amp = q.amp, rk = q.rank_pct;
  if (c >= 3 && c <= 8 && vr >= 1.5 && tr > 5 && brk <= 20 && hasMa && bias <= 12 && mv >= 50 && amp < 12 && rk <= 30) return 'core';
  if (c >= 2 && c <= 9 && vr >= 1.3 && tr > 3 && brk <= 15 && hasMa && bias <= 18 && mv >= 30 && amp < 15 && rk <= 40) return 'sec';
  if (c >= 1.5 && c <= 9.5 && vr >= 1.1 && tr > 2 && brk <= 10 && hasMa && bias <= 22 && mv >= 20 && amp < 18 && rk <= 50) return 'back';
  return null;
}
function scanEtfLayer(q) {
  var amt = q.amount || 0, size = q.mkt_cap || 0, vr = q.vr || 0, tr = q.turnover || 0;
  if (amt > 2000 && size > 5 && vr > 1.2 && tr > 1) return 'core';
  if (amt > 800 && size > 2 && vr > 0.8 && tr > 0.6) return 'sec';
  if (amt > 300 && size > 1 && vr > 0.3 && tr > 0.3) return 'back';
  return null;
}

const INIT_CASH = 1000000;      // 初始模拟资金 100 万
const STOP_LOSS = -0.12;        // 止损线 -12%
const TAKE_PROFIT = 0.25;       // 止盈线 +25%

/** 每日自动交易主入口（幂等：同日只执行一次） */
export async function executeDailyTrade(env) {
  var now = new Date();
  var today = now.toISOString().slice(0, 10);
  // 幂等检查
  var last = await env.DB.prepare("SELECT value FROM settings WHERE key = 'last_trade_date'").first();
  if (last && last.value === today) {
    return { skipped: true, message: '今日已执行自动交易', date: today };
  }

  // 1. 读取最新市场快照（股票 + ETF）
  var latest = await env.DB.prepare("SELECT MAX(timestamp) as t FROM market_data").first();
  var rows = latest && latest.t
    ? (await env.DB.prepare("SELECT * FROM market_data WHERE timestamp = ? AND type IN ('stock','etf')").bind(latest.t).all()).results || []
    : [];
  var latestF = await env.DB.prepare("SELECT MAX(timestamp) as t FROM fund_offsite").first();
  var funds = latestF && latestF.t
    ? (await env.DB.prepare("SELECT * FROM fund_offsite WHERE timestamp = ?").bind(latestF.t).all()).results || []
    : [];

  // 2. 计算分层
  var layerMap = {};
  rows.forEach(function (r) {
    layerMap[r.code] = { type: r.type, name: r.name, price: r.price, layer: r.type === 'etf' ? scanEtfLayer(r) : scanStockLayer(r) };
  });
  funds.forEach(function (r) {
    // 场外基金：纳入候选（净值真实），分层简化：规模≥2亿且成立≥3年 → back，规模≥10亿 → sec
    var layer = (r.scale != null && r.yoy != null && r.scale >= 2 && r.yoy >= 3) ? (r.scale >= 10 ? 'sec' : 'back') : null;
    layerMap[r.code] = { type: 'tradfund', name: r.name, price: r.nav, layer: layer };
  });

  // 3. 读取当前持仓
  var holds = (await env.DB.prepare("SELECT * FROM paper_portfolio").all()).results || [];
  var holdMap = {};
  holds.forEach(function (h) { holdMap[h.code] = h; });

  // 4. 现金
  var cashRow = await env.DB.prepare("SELECT value FROM settings WHERE key = 'paper_cash'").first();
  var cash = cashRow && cashRow.value != null ? parseFloat(cashRow.value) : INIT_CASH;

  var trades = [];
  var toBuy = [], toSell = [], toTrim = [];

  // 分层扫描：core 层且无持仓 → 建仓候选
  Object.keys(layerMap).forEach(function (code) {
    var info = layerMap[code];
    var h = holdMap[code];
    if (!info.layer) { if (h) toSell.push({ code: code, h: h, reason: '跌出备选层' }); return; }
    if (h) {
      // 已有持仓：止损/止盈检查 + 更新价格
      var pnlPct = (info.price - h.cost_price) / h.cost_price;
      if (pnlPct <= STOP_LOSS) toSell.push({ code: code, h: h, reason: '止损触发 ' + (pnlPct * 100).toFixed(1) + '%' });
      else if (pnlPct >= TAKE_PROFIT) toTrim.push({ code: code, h: h, pnlPct: pnlPct });
    } else if (info.layer === 'core') {
      toBuy.push({ code: code, info: info });
    }
  });

  // 5. 执行卖出（先卖后买）
  for (var i = 0; i < toSell.length; i++) {
    var s = toSell[i];
    var price = layerMap[s.code] ? layerMap[s.code].price : (s.h.current_price || s.h.cost_price);
    if (!price) continue;
    var amt = +(price * s.h.shares).toFixed(2);
    cash += amt;
    await env.DB.prepare("DELETE FROM paper_portfolio WHERE code = ?").bind(s.code).run();
    await env.DB.prepare("INSERT INTO trade_log (trade_date, code, name, action, price, shares, amount, reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(today, s.code, s.h.name, s.h.cost_price > price ? 'sell_stop' : 'sell', price, s.h.shares, amt, s.reason).run();
    trades.push({ code: s.code, name: s.h.name, action: 'sell', price: price, shares: s.h.shares, amount: amt, reason: s.reason });
  }

  // 6. 执行止盈减半
  for (var j = 0; j < toTrim.length; j++) {
    var t = toTrim[j];
    var price = layerMap[t.code].price;
    var half = +(t.h.shares / 2).toFixed(0);
    if (half <= 0) continue;
    var amt = +(price * half).toFixed(2);
    cash += amt;
    await env.DB.prepare("UPDATE paper_portfolio SET shares = shares - ? , current_price = ? , updated_at = ? WHERE code = ?")
      .bind(half, price, now.toISOString(), t.code).run();
    await env.DB.prepare("INSERT INTO trade_log (trade_date, code, name, action, price, shares, amount, reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(today, t.code, t.h.name, 'sell_trim', price, half, amt, '止盈 ' + (t.pnlPct * 100).toFixed(1) + '% 减半').run();
    trades.push({ code: t.code, name: t.h.name, action: 'sell_trim', price: price, shares: half, amount: amt, reason: '止盈减半' });
  }

  // 7. 执行建仓（等权：现金 / 建仓数，单标的上限 20%）
  if (toBuy.length) {
    var budget = Math.min(cash, cash / toBuy.length);
    for (var k = 0; k < toBuy.length; k++) {
      var b = toBuy[k];
      var price = b.info.price;
      if (!price || price <= 0) continue;
      var invest = Math.min(budget, cash * 0.2, cash);
      var shares = Math.floor(invest / price / 100) * 100;   // 整手（股票 100 股；ETF 100 份）
      if (b.info.type === 'tradfund') shares = Math.floor(invest / price * 100) / 100;  // 场外按金额
      if (shares <= 0 || cash < price) continue;
      var amt = +(price * shares).toFixed(2);
      cash -= amt;
      var existing = await env.DB.prepare("SELECT * FROM paper_portfolio WHERE code = ?").bind(b.code).first();
      if (existing) {
        // 已有持仓（core 加仓）
        var newShares = existing.shares + shares;
        var newCost = (existing.cost_price * existing.shares + amt) / newShares;
        await env.DB.prepare("UPDATE paper_portfolio SET shares = ?, cost_price = ?, current_price = ?, layer = ?, updated_at = ? WHERE code = ?")
          .bind(newShares, +newCost.toFixed(4), price, 'core', now.toISOString(), b.code).run();
      } else {
        await env.DB.prepare("INSERT INTO paper_portfolio (code, name, type, shares, cost_price, current_price, layer, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
          .bind(b.code, b.info.name, b.info.type, shares, +price.toFixed(4), price, 'core', now.toISOString()).run();
      }
      await env.DB.prepare("INSERT INTO trade_log (trade_date, code, name, action, price, shares, amount, reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(today, b.code, b.info.name, 'buy', price, shares, amt, '进入核心层建仓').run();
      trades.push({ code: b.code, name: b.info.name, action: 'buy', price: price, shares: shares, amount: amt, reason: '进入核心层' });
    }
  }

  // 8. 更新剩余持仓最新价 + 记录状态
  var remain = (await env.DB.prepare("SELECT * FROM paper_portfolio").all()).results || [];
  for (var m = 0; m < remain.length; m++) {
    var rr = remain[m];
    var info = layerMap[rr.code];
    var cur = info ? info.price : rr.current_price;
    await env.DB.prepare("UPDATE paper_portfolio SET current_price = ?, layer = ?, updated_at = ? WHERE code = ?")
      .bind(cur, info ? (info.layer || 'back') : rr.layer, now.toISOString(), rr.code).run();
  }

  // 9. 持久化现金与日期
  await env.DB.prepare("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('paper_cash', ?, ?)").bind(String(cash.toFixed(2)), now.toISOString()).run();
  await env.DB.prepare("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('last_trade_date', ?, ?)").bind(today, now.toISOString()).run();
  await env.DB.prepare("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('last_trade_summary', ?, ?)").bind(JSON.stringify(trades), now.toISOString()).run();

  // 10. 汇总持仓估值
  var finalHolds = (await env.DB.prepare("SELECT * FROM paper_portfolio").all()).results || [];
  var posValue = 0;
  finalHolds.forEach(function (h) { posValue += (h.current_price || h.cost_price) * h.shares; });

  return {
    skipped: false,
    date: today,
    trades: trades,
    cash: +cash.toFixed(2),
    positions: finalHolds.length,
    posValue: +posValue.toFixed(2),
    total: +(cash + posValue).toFixed(2)
  };
}

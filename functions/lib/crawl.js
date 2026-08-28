/**
 * Z-quantization 真实数据源爬取共享库
 * ============================================================
 * 数据源（Data source.txt 规范，全部免 Key 公共接口）：
 *  1) 股票 / 指数 / 场内 ETF 行情  → 腾讯行情 qt.gtimg.cn（GBK，批量，含换手/量比/市值/PE/PB）
 *  2) 场外基金详情（名称/类型/成立日期/公司/经理）→ 天天基金移动端 fundmobapi.eastmoney.com
 *  3) 场外基金净值/规模/阶段收益/机构占比/持仓 → 天天基金主站 pingzhongdata/{code}.js
 *  4) 财经新闻 → 新浪财经 7x24 直播 zhibo.sina.com.cn
 * 防封策略（Data source.txt 爬取防封策略）：随机 UA + 随机延迟 + 指数退避重试 + 429 解析 Retry-After
 * ============================================================
 */

const UA_LIST = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0'
];

/** 随机 UA（伪装请求头） */
export function randomUA() {
  return UA_LIST[Math.floor(Math.random() * UA_LIST.length)];
}

/** 随机延迟（模拟人类行为，防封） */
export function sleep(ms) {
  return new Promise(function (r) { setTimeout(r, ms); });
}
export function randomDelay(min, max) {
  return sleep(Math.floor(min + Math.random() * (max - min)));
}

/** 指数退避重试（429/5xx 重试，解析 Retry-After；Data source.txt：智能重试策略） */
export async function fetchRetry(url, opts, tries) {
  var max = tries || 3;
  for (var i = 0; i < max; i++) {
    var res;
    try {
      res = await fetch(url, opts);
    } catch (e) {
      if (i === max - 1) throw e;
      await sleep(500 * Math.pow(2, i) + Math.floor(Math.random() * 400));
      continue;
    }
    if (res.status === 429 || res.status >= 500) {
      if (i === max - 1) return res;
      var ra = res.headers.get('Retry-After');
      var wait = ra ? parseInt(ra, 10) * 1000 : (500 * Math.pow(2, i) + Math.floor(Math.random() * 500));
      await sleep(Math.min(wait, 8000));
      continue;
    }
    return res;
  }
  return res;
}

/** 通用抓取：按编码解码文本 */
export async function fetchText(url, encoding, opts) {
  var headers = Object.assign({ 'User-Agent': randomUA(), 'Referer': 'https://www.baidu.com/' }, (opts && opts.headers) || {});
  var res = await fetchRetry(url, Object.assign({}, opts, { headers: headers }), (opts && opts.tries) || 3);
  var buf = new Uint8Array(await res.arrayBuffer());
  try {
    return new TextDecoder(encoding || 'utf-8').decode(buf);
  } catch (e) {
    return new TextDecoder('utf-8').decode(buf);
  }
}

/* ============================================================
 * 1. 腾讯行情（股票 / 指数 / 场内 ETF）
 * 字段索引（实测验证）：[1]名称 [2]代码 [3]现价 [4]昨收 [5]今开 [6]成交量(手)
 * [30]时间 [31]涨跌额 [32]涨跌幅% [33]最高 [34]最低 [37]成交额(万)
 * [38]换手率% [39]PE [43]振幅% [44]流通市值(亿) [45]总市值(亿) [46]PB [49]量比
 * ============================================================ */
function marketPrefix(code) {
  code = String(code);
  if (/^000001$/.test(code) || /^000300$/.test(code) || /^000905$/.test(code) || /^000688$/.test(code)) return 'sh';
  if (/^399/.test(code)) return 'sz';
  if (/^899|^82|^92/.test(code)) return 'bj';
  if (/^[69]/.test(code)) return 'sh';
  if (/^5/.test(code)) return 'sh';            // 51x 沪市 ETF
  if (/^[013]/.test(code)) return 'sz';        // 000/002/300/159/16x
  if (/^[24]/.test(code)) return 'sz';
  if (/^[78]/.test(code)) return 'bj';
  return 'sh';
}

export function tencentCode(code) {
  code = String(code);
  if (/^hk/i.test(code) && /^hk[A-Z]{2,5}$/i.test(code)) return code;   // hkHSI 等：保持原样（腾讯要求 hk 小写）
  if (/\.(SH|SZ|BJ)$/i.test(code)) {
    var suffix = code.split('.').pop().toLowerCase();
    return (suffix === 'sh' ? 'sh' : suffix) + code.split('.')[0];
  }
  if (/^[a-z]{2}\d+$/i.test(code)) return code.toLowerCase();
  return marketPrefix(code) + code;
}

/** 解析单条腾讯行情（A股/港股统一字段布局：[30]时间 [31]涨跌额 [32]涨跌幅 [33]最高 [34]最低） */
function parseTencentLine(line) {
  var eq = line.indexOf('=');
  if (eq < 0) return null;
  var varName = line.slice(0, eq).trim();                 // v_sh600519 / v_hkHSI
  var raw = line.slice(eq + 1).trim().replace(/^"|";?$/g, '');
  var f = raw.split('~');
  var mkt = varName.replace(/^v_/, '').slice(0, 2);       // sh / sz / hk / bj
  if (f.length < 35) return null;
  var num = function (i) { var v = parseFloat(f[i]); return isFinite(v) ? v : null; };
  return {
    market: mkt,
    code: f[2] || varName.slice(3),
    name: f[1] || '',
    price: num(3),
    prevClose: num(4),
    open: num(5),
    volume: num(6),                 // 手
    time: f[30] || '',
    chg: num(31),
    chgPct: num(32),
    high: num(33),
    low: num(34),
    amount: num(37),                // 万元（A股；港股 null）
    turnover: num(38),              // 换手率 %（A股；港股 null）
    pe: num(39),
    amp: num(43),                   // 振幅 %（A股）
    floatCap: num(44),              // 流通市值 亿（A股）
    mktCap: num(45),                // 总市值 亿（A股；港股指数 null）
    pb: num(46),
    vr: num(49)                     // 量比（A股）
  };
}

/** 批量行情（codes 为纯代码数组） */
export async function tencentQuotes(codes) {
  if (!codes || !codes.length) return [];
  var out = [];
  // 分批（单批 ≤ 60，防 URL 过长）
  var CHUNK = 60;
  for (var i = 0; i < codes.length; i += CHUNK) {
    var chunk = codes.slice(i, i + CHUNK);
    var qs = chunk.map(tencentCode).join(',');
    var text = await fetchText('https://qt.gtimg.cn/q=' + qs, 'gbk');
    text.split(';').forEach(function (line) {
      line = line.trim();
      if (!line) return;
      var p = parseTencentLine(line);
      if (p) out.push(p);
    });
    if (i + CHUNK < codes.length) await randomDelay(800, 2000);
  }
  return out;
}

/* ============================================================
 * 1.5 腾讯日 K 线（60 日，用于 screening.txt：站上60日线 / 乖离 / 突破 / 量价排名）
 * ============================================================ */
export async function tencentKline(code, days) {
  var tc = tencentCode(code);
  var url = 'https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=' + tc + ',day,,,' + (days || 60) + ',qfq';
  var text = await fetchText(url, 'utf-8');
  var d;
  try { d = JSON.parse(text); } catch (e) { return null; }
  var node = d && d.data && (d.data[tc] || d.data[Object.keys(d.data || {})[0]]);
  var arr = (node && (node.qfqday || node.day)) || [];
  if (!arr.length) return null;
  // 计算 60 日 MA / 乖离 / 突破 / 量价排名
  var closes = arr.map(function (k) { return parseFloat(k[2]); }).filter(function (v) { return isFinite(v); });
  var vols = arr.map(function (k) { return parseFloat(k[5]); }).filter(function (v) { return isFinite(v); });
  if (!closes.length) return null;
  var last = closes[closes.length - 1];
  var ma60 = closes.reduce(function (a, b) { return a + b; }, 0) / closes.length;
  var bias = ma60 ? ((last - ma60) / ma60) * 100 : null;
  // 突破：现价 > 近 5/10/20 日最高价
  var hi5 = Math.max.apply(null, closes.slice(-5));
  var hi10 = Math.max.apply(null, closes.slice(-10));
  var hi20 = Math.max.apply(null, closes.slice(-20));
  var brk = 0;
  if (last >= hi20 && hi20 > hi10) brk = 20;
  else if (last >= hi10 && hi10 > hi5) brk = 10;
  else if (last >= hi5) brk = 5;
  // 量价排名：当日量在 60 日中的百分位（越小越靠前）
  var curVol = vols[vols.length - 1] || 0;
  var rankPct = null;
  if (vols.length > 1) {
    var below = vols.filter(function (v) { return v < curVol; }).length;
    rankPct = Math.round((below / vols.length) * 100);
  }
  return {
    code: code,
    price: last,
    ma60: ma60,
    bias: bias != null ? +bias.toFixed(2) : null,
    brk: brk,
    rankPct: rankPct,
    days: closes.length
  };
}

/* ============================================================
 * 2. 场外基金 — 天天基金移动端基础信息
 * FundMNBasicInformation：最新净值/日涨幅/份额/阶段收益/经理/公司/成立日期/申赎状态
 * ============================================================ */
export async function fundMobileBasic(fcode) {
  var url = 'https://fundmobapi.eastmoney.com/FundMNewApi/FundMNBasicInformation'
    + '?FCODE=' + fcode + '&deviceid=Wap&plat=Wap&product=EFund&version=6.2.8';
  var text = await fetchText(url, 'utf-8');
  var d;
  try { d = JSON.parse(text); } catch (e) { return null; }
  var r = d && d.Datas;
  if (!r) return null;
  var f = function (k) { var v = parseFloat(r[k]); return isFinite(v) ? v : null; };
  var estabDate = r.ISSEDATE ? String(r.ISSEDATE).slice(0, 10) : '';
  var yoy = null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(estabDate)) {
    var now = new Date();
    var ey = parseInt(estabDate.slice(0, 4), 10);
    var em = parseInt(estabDate.slice(5, 7), 10);
    yoy = (now.getFullYear() - ey) + (now.getMonth() + 1 - em) / 12;
  }
  var shares = f('FEGM');           // 基金份额（份）
  var nav = f('DWJZ');              // 单位净值
  return {
    code: r.FCODE || fcode,
    name: r.SHORTNAME || '',
    type: r.FTYPE || '',
    estabDate: estabDate,
    yoy: yoy,                                    // 成立年限（年）
    company: r.JJGS || '',
    managers: r.JJJL ? String(r.JJJL).split(',').map(function (s) { return s.trim(); }).filter(Boolean) : [],
    riskLevel: r.RISKLEVEL || '',
    nav: nav,                                    // 最新单位净值
    navDate: r.FSRQ || '',
    dailyChg: f('RZDF'),                         // 日涨幅 %
    accNav: f('LJJZ'),                           // 累计净值
    shares: shares,                              // 份额（份）
    scale: (nav != null && shares != null) ? +(nav * shares / 1e8).toFixed(2) : null,  // 规模（亿）
    buyState: r.SGZT || '',
    sellState: r.SHZT || '',
    syl: {                                       // 阶段收益 %
      w1: f('SYL_Z'), m1: f('SYL_Y'), m3: f('SYL_3Y'), m6: f('SYL_6Y'),
      y1: f('SYL_1N'), y2: f('SYL_2N'), y3: f('SYL_3N'), ytd: f('SYL_JN'), since: f('SYL_LN')
    }
  };
}

/** 场外基金详情（投资范围/业绩基准，补充字段） */
export async function fundMobileDetail(fcode) {
  var url = 'https://fundmobapi.eastmoney.com/FundMNewApi/FundMNDetailInformation'
    + '?FCODE=' + fcode + '&deviceid=Wap&plat=Wap&product=EFund&version=6.2.8';
  var text = await fetchText(url, 'utf-8');
  var d;
  try { d = JSON.parse(text); } catch (e) { return null; }
  var r = d && d.Datas;
  if (!r) return null;
  return {
    code: r.FCODE || fcode,
    name: r.SHORTNAME || '',
    fullName: r.FULLNAME || '',
    type: r.FTYPE || '',
    estabDate: r.ESTABDATE || '',
    company: r.JJGS || '',
    managers: r.JJJL ? r.JJJL.split(',').map(function (s) { return s.trim(); }).filter(Boolean) : [],
    riskLevel: r.RISKLEVEL || '',
    bench: r.BENCH || ''
  };
}

/* ============================================================
 * 3. 场外基金 — 主站 pingzhongdata（净值/规模/阶段收益/机构占比/持仓）
 * 返回 JS 变量文件，正则提取（不 eval）
 * ============================================================ */
function extractVar(text, name) {
  var re = new RegExp('var\\s+' + name + '\\s*=\\s*', 'g');
  var m = re.exec(text);
  if (!m) return null;
  var start = m.index + m[0].length;
  var end = text.indexOf(';', start);
  if (end < 0) end = text.length;
  return text.slice(start, end).trim();
}
function extractArrayEnd(text, marker) {
  // 定位 var X = 后的 '[' 与配对的 ']'（数组内对象无嵌套数组）
  var idx = text.indexOf(marker);
  if (idx < 0) return null;
  var start = text.indexOf('[', idx);
  if (start < 0) return null;
  var depth = 0, inStr = false;
  for (var i = start; i < text.length; i++) {
    var c = text[i];
    if (inStr) { if (c === '\\') i++; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === '[') depth++;
    else if (c === ']') { depth--; if (depth === 0) return text.slice(start, i + 1); }
  }
  return null;
}

export async function fundPingzhong(fcode) {
  var url = 'https://fund.eastmoney.com/pingzhongdata/' + fcode + '.js';
  var text = await fetchText(url, 'utf-8', { headers: { 'Referer': 'https://fund.eastmoney.com/' + fcode + '.html' } });
  var out = { code: fcode };
  var nameM = /fS_name\s*=\s*"([^"]*)"/.exec(text);
  out.name = nameM ? nameM[1] : '';
  // 阶段收益率
  ['syl_1y', 'syl_3y', 'syl_6y', 'syl_1n'].forEach(function (k) {
    var m = new RegExp('var\\s+' + k + '\\s*=\\s*"([^"]*)"').exec(text);
    out[k] = m ? parseFloat(m[1]) : null;
  });
  // 历史净值趋势（Data_netWorthTrend，取最后一条 + 完整序列供多因子计算）
  var trendStr = extractArrayEnd(text, 'Data_netWorthTrend');
  if (trendStr) {
    try {
      var trend = JSON.parse(trendStr);
      if (trend && trend.length) {
        var last = trend[trend.length - 1];
        out.nav = last.y;
        out.navDate = last.x ? new Date(last.x).toISOString().slice(0, 10) : '';
        out.dailyChg = (last.equityReturn != null) ? last.equityReturn : null;
        out._trend = trend.slice(-300);   // 近一年日净值（含余量），供索提诺/卡玛计算
      }
    } catch (e) { /* ignore */ }
  }
  // 累计净值
  var acStr = extractArrayEnd(text, 'Data_ACWorthTrend');
  if (acStr) {
    try {
      var ac = JSON.parse(acStr);
      if (ac && ac.length) out.accNav = ac[ac.length - 1].y;
    } catch (e) { /* ignore */ }
  }
  // 机构/个人持有占比（Data_holderStructure = {series:[{name:'机构持有比例',data:[...]},...],categories:[...]}）
  var hsStr = extractVar(text, 'Data_holderStructure');
  if (hsStr) {
    try {
      var hs = JSON.parse(hsStr);
      if (hs && hs.series && hs.series.length) {
        var inst = hs.series.filter(function (s) { return (s.name || '').indexOf('机构') >= 0; })[0];
        var hdata = inst ? inst.data : (hs.series[0] && hs.series[0].data);
        if (hdata && hdata.length) out.instPct = hdata[hdata.length - 1];
      }
    } catch (e) { /* ignore */ }
  }
  // 持仓股票代码（stockCodesNew）
  var scStr = extractVar(text, 'stockCodesNew');
  if (scStr) {
    try { out.stocks = JSON.parse(scStr); } catch (e) { out.stocks = []; }
  }
  // V2.5 多因子：索提诺 / 卡玛 / 年化（基于真实日净值序列计算）
  if (out._trend && out._trend.length > 30) {
    var ratios = calcSortinoCalmar(out._trend);
    out.sortino = ratios.sortino;
    out.calmar = ratios.calmar;
    out.yoyAnn = ratios.yoyAnn;
  }
  out.scale = null;   // 规模以 fundMobileBasic().scale（份额×净值）为准
  return out;
}

/** 从日净值序列计算索提诺/卡玛/年化收益（无风险利率按 0 简化，A 股量化常用） */
function calcSortinoCalmar(series) {
  var rets = [];
  for (var i = 1; i < series.length; i++) {
    var prev = series[i - 1].y, cur = series[i].y;
    if (!prev || !cur) continue;
    rets.push(cur / prev - 1);
  }
  var out = { sortino: null, calmar: null, yoyAnn: null };
  if (rets.length < 20) return out;
  var n = rets.length;
  var mean = rets.reduce(function (a, b) { return a + b; }, 0) / n;
  var ann = Math.pow(1 + mean, 250) - 1;
  var ddSum = 0, ddN = 0;
  rets.forEach(function (r) { if (r < 0) { ddSum += r * r; ddN++; } });
  var dstd = ddN ? Math.sqrt(ddSum / ddN) : 0;
  if (dstd > 0) out.sortino = +((mean / dstd) * Math.sqrt(250)).toFixed(2);
  // 最大回撤（净值曲线）
  var peak = -Infinity, mdd = 0;
  series.forEach(function (pt) {
    if (!pt.y) return;
    if (pt.y > peak) peak = pt.y;
    var dd = (pt.y - peak) / peak;
    if (dd < mdd) mdd = dd;
  });
  if (Math.abs(mdd) > 1e-6) out.calmar = +(ann / Math.abs(mdd)).toFixed(2);
  out.yoyAnn = +(ann * 100).toFixed(2);
  return out;
}

/* ============================================================
 * 4. 新闻 — 新浪财经 7x24 直播
 * ============================================================ */
export async function sinaNews7x24(pageSize) {
  var n = pageSize || 30;
  var url = 'https://zhibo.sina.com.cn/api/zhibo/feed?page=1&page_size=' + n
    + '&zhibo_id=152&tag_id=0&dire=f&dpc=1';
  var text = await fetchText(url, 'utf-8');
  var d;
  try { d = JSON.parse(text); } catch (e) { return []; }
  var list = (d && d.result && d.result.data && d.result.data.feed && d.result.data.feed.list) || [];
  return list.map(function (it) {
    var t = it.rich_text || it.text || '';
    t = t.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
    return {
      id: it.id,
      title: t.length > 60 ? t.slice(0, 60) + '…' : t,
      content: t,
      time: it.create_time || '',
      ts: it.create_time ? new Date(it.create_time.replace(/-/g, '/')).getTime() : null,
      source: (it.source && it.source.name) || '新浪财经'
    };
  }).filter(function (it) { return it.title; });
}

/* ============================================================
 * 5. 情感 / 分类规则（对真实文本计算，非虚构）
 * ============================================================ */
const POS_WORDS = ['涨', '利好', '增长', '提升', '超预期', '新高', '净买入', '增持', '批准', '反弹', '复苏', '突破', '创纪录', '预增', '扭亏', '中标', '签约', '回购'];
const NEG_WORDS = ['跌', '利空', '下滑', '下降', '低于预期', '新低', '净卖出', '减持', '处罚', '亏损', '预减', '违约', '风险', '下调', '退市', '立案', '调查', '暴雷'];
export function sentimentOf(text) {
  var s = String(text || '');
  var p = 0, ng = 0;
  POS_WORDS.forEach(function (w) { if (s.indexOf(w) >= 0) p++; });
  NEG_WORDS.forEach(function (w) { if (s.indexOf(w) >= 0) ng++; });
  if (p > ng) return 1;
  if (ng > p) return -1;
  return 0;
}
const CAT_RULES = [
  ['policy', ['央行', '证监会', '国务院', '发改委', '财政部', '降准', '降息', '政策', '监管', '利率', 'LPR', 'MLF', '税', '改革', '通知', '意见', '方案']],
  ['company', ['公司', '公告', '业绩', '财报', '营收', '净利润', '签约', '中标', '回购', '增持', '减持', '披露', '预增', '预减']],
  ['sector', ['板块', '行业', '概念', '半导体', '新能源', '医药', '券商', '银行', '地产', '消费', '科技', 'AI', '芯片', '光伏', '汽车', '白酒']],
  ['global', ['美股', '美联储', '鲍威尔', '非农', '欧股', '日经', '亚太', '全球', '美元', '原油', '黄金', '纳指', '道指']],
  ['macro', ['GDP', 'CPI', 'PMI', '工业增加值', '社融', 'M2', '通胀', '经济', '就业', '出口', '进口']]
];
export function categoryOf(text) {
  var s = String(text || '');
  for (var i = 0; i < CAT_RULES.length; i++) {
    var hit = CAT_RULES[i][1].some(function (w) { return s.indexOf(w) >= 0; });
    if (hit) return CAT_RULES[i][0];
  }
  return 'macro';
}

/** 当前是否为 A 股交易时段（周一~周五 09:30-11:30 / 13:00-15:00） */
export function isTradingTime(now) {
  now = now || new Date();
  var day = now.getDay();
  if (day === 0 || day === 6) return false;
  var h = now.getHours(), m = now.getMinutes();
  var t = h * 100 + m;
  return (t >= 930 && t <= 1130) || (t >= 1300 && t <= 1500);
}

-- 市场数据表（真实数据：腾讯行情 + 股票60日K线扫描属性；type: index/stock/etf）
DROP TABLE IF EXISTS market_data;
CREATE TABLE market_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,  -- 'index', 'stock', 'etf'
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  price REAL,
  chg REAL,
  chg_pct REAL,
  volume REAL,
  amount REAL,
  turnover REAL,      -- 换手率 %
  vr REAL,            -- 量比
  mkt_cap REAL,       -- 总市值（亿）
  amp REAL,           -- 振幅 %
  ma60 REAL,          -- 60日均线（股票，K线计算）
  bias REAL,          -- 乖离率 %（股票=对60日线；ETF=当日涨幅近似）
  brk INTEGER,        -- 突破天数（股票=真实；ETF=当日涨幅派生）
  rank_pct INTEGER,   -- 量价排名百分位
  timestamp TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 基金数据表
CREATE TABLE IF NOT EXISTS fund_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  price REAL,
  nav REAL,
  chg REAL,
  chg_pct REAL,
  volume REAL,
  iopv REAL,
  discount REAL,
  timestamp TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 新闻数据表
CREATE TABLE IF NOT EXISTS news_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT,
  sentiment INTEGER DEFAULT 0,  -- -1: 负面, 0: 中性, 1: 正面
  category TEXT,  -- 'macro', 'tech', 'earnings', 'policy'
  sources TEXT,  -- JSON array of sources
  stocks TEXT,  -- JSON array of stock codes
  url TEXT,
  timestamp TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 智能体持仓表
CREATE TABLE IF NOT EXISTS agent_positions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  weight REAL,
  shares INTEGER,
  cost_price REAL,
  current_price REAL,
  pnl REAL,
  pnl_pct REAL,
  updated_at TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 因子数据表
CREATE TABLE IF NOT EXISTS factor_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL,
  factor_name TEXT NOT NULL,
  factor_value REAL,
  factor_rank INTEGER,
  factor_pct REAL,
  timestamp TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 场外主动基金数据表（真实数据：天天基金；20 只候选池）
DROP TABLE IF EXISTS fund_offsite;
CREATE TABLE fund_offsite (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  nav REAL,
  nav_date TEXT,
  chg_pct REAL,
  acc_nav REAL,
  scale REAL,           -- 规模（亿）= 份额×净值
  mgr TEXT,             -- 基金经理（逗号分隔）
  estab_date TEXT,
  yoy REAL,             -- 成立年限（年）
  inst_pct REAL,        -- 机构持有占比 %
  syl_1m REAL, syl_3m REAL, syl_6m REAL, syl_1y REAL,
  sortino REAL,         -- 索提诺比率（净值序列计算）
  calmar REAL,          -- 卡玛比率（净值序列计算）
  yoy_ann REAL,         -- 年化收益 %
  buy_state TEXT,
  timestamp TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 基金经理聚合表（从场外基金聚合）
CREATE TABLE IF NOT EXISTS fund_managers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  codes TEXT,           -- 管理基金 "code|name;..."
  count INTEGER,
  scale REAL,           -- 合计管理规模（亿）
  avg_yoy REAL,         -- 平均任职年限
  updated_at TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 设置表
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 模拟盘持仓表（每日自动交易引擎：真实行情驱动）
CREATE TABLE IF NOT EXISTS paper_portfolio (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,       -- stock / etf / tradfund
  shares REAL NOT NULL,     -- 持仓数量（股/份）
  cost_price REAL NOT NULL, -- 成本价
  current_price REAL,       -- 最新价
  layer TEXT,               -- 当前分层 core/sec/back
  updated_at TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_paper_code ON paper_portfolio(code);

-- 自动交易记录表
CREATE TABLE IF NOT EXISTS trade_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trade_date TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  action TEXT NOT NULL,     -- buy / sell / sell_stop / sell_trim
  price REAL NOT NULL,
  shares REAL NOT NULL,
  amount REAL NOT NULL,
  reason TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_trade_date ON trade_log(trade_date);

-- 同步日志表
CREATE TABLE IF NOT EXISTS sync_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task TEXT NOT NULL,
  status TEXT NOT NULL,  -- 'success', 'failed'
  message TEXT,
  duration_ms INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_market_type ON market_data(type);
CREATE INDEX IF NOT EXISTS idx_market_code ON market_data(code);
CREATE INDEX IF NOT EXISTS idx_market_timestamp ON market_data(timestamp);
CREATE INDEX IF NOT EXISTS idx_fund_code ON fund_data(code);
CREATE INDEX IF NOT EXISTS idx_fund_offsite_code ON fund_offsite(code);
CREATE INDEX IF NOT EXISTS idx_fund_offsite_ts ON fund_offsite(timestamp);
CREATE INDEX IF NOT EXISTS idx_fund_mgr_name ON fund_managers(name);
CREATE INDEX IF NOT EXISTS idx_news_timestamp ON news_data(timestamp);
CREATE INDEX IF NOT EXISTS idx_news_sentiment ON news_data(sentiment);
CREATE INDEX IF NOT EXISTS idx_factor_code ON factor_data(code);
CREATE INDEX IF NOT EXISTS idx_sync_log_created ON sync_log(created_at);

-- 清空历史虚拟数据（2026-08-28 接入真实数据源；agent_positions 为模拟盘持仓，保留）
DELETE FROM market_data;
DELETE FROM fund_data;
DELETE FROM news_data;
DELETE FROM factor_data;
DELETE FROM sync_log;

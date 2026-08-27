-- 市场数据表
CREATE TABLE IF NOT EXISTS market_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,  -- 'index', 'stock', 'etf'
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  price REAL,
  chg REAL,
  chg_pct REAL,
  volume REAL,
  amount REAL,
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

-- 设置表
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

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
CREATE INDEX IF NOT EXISTS idx_news_timestamp ON news_data(timestamp);
CREATE INDEX IF NOT EXISTS idx_news_sentiment ON news_data(sentiment);
CREATE INDEX IF NOT EXISTS idx_factor_code ON factor_data(code);
CREATE INDEX IF NOT EXISTS idx_sync_log_created ON sync_log(created_at);

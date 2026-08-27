/**
 * Z-quantization API 客户端
 * 所有后端 API 调用封装在此
 */

const API_BASE = '/api';

// 市场数据
const MarketAPI = {
  /**
   * 获取市场概览数据
   * @returns {Promise<Object>} 指数、行情数据
   */
  async getMarket() {
    const res = await fetch(`${API_BASE}/market`);
    return res.json();
  },
  
  /**
   * 获取个股详情
   * @param {string} code 股票代码
   * @returns {Promise<Object>} 个股数据
   */
  async getStock(code) {
    const res = await fetch(`${API_BASE}/market/stock/${code}`);
    return res.json();
  },
  
  /**
   * 批量获取股票数据
   * @param {string[]} codes 股票代码列表
   * @returns {Promise<Object[]>} 股票数据数组
   */
  async getStocks(codes) {
    const res = await fetch(`${API_BASE}/market/stocks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codes })
    });
    return res.json();
  }
};

// 基金数据
const FundAPI = {
  /**
   * 获取基金列表
   * @returns {Promise<Object>} 基金数据
   */
  async getList() {
    const res = await fetch(`${API_BASE}/fund`);
    return res.json();
  },
  
  /**
   * 获取基金经理信息
   * @param {string} code 基金代码
   * @returns {Promise<Object>} 基金经理数据
   */
  async getManager(code) {
    const res = await fetch(`${API_BASE}/fund/manager/${code}`);
    return res.json();
  },
  
  /**
   * 获取 ETF IOPV 数据
   * @param {string} code ETF 代码
   * @returns {Promise<Object>} ETF 数据
   */
  async getETF(code) {
    const res = await fetch(`${API_BASE}/fund/etf/${code}`);
    return res.json();
  }
};

// 新闻数据
const NewsAPI = {
  /**
   * 获取新闻列表
   * @param {Object} params 查询参数
   * @returns {Promise<Object>} 新闻数据
   */
  async getList(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/news${query ? '?' + query : ''}`);
    return res.json();
  },
  
  /**
   * 获取情感分析数据
   * @param {string} code 股票代码
   * @returns {Promise<Object>} 情感数据
   */
  async getSentiment(code) {
    const res = await fetch(`${API_BASE}/news/sentiment?code=${code}`);
    return res.json();
  }
};

// 风险指标
const RiskAPI = {
  /**
   * 重新计算风险指标
   * @returns {Promise<Object>} 风险指标数据
   */
  async recalc() {
    const res = await fetch(`${API_BASE}/risk/metrics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: 'recalc' })
    });
    return res.json();
  },
  
  /**
   * 执行压力测试
   * @param {string} scenario 场景名称
   * @returns {Promise<Object>} 压力测试结果
   */
  async stressTest(scenario) {
    const res = await fetch(`${API_BASE}/risk/stress?scenario=${scenario}`);
    return res.json();
  }
};

// 导出所有 API 模块
window.ZQ_API = {
  market: MarketAPI,
  fund: FundAPI,
  news: NewsAPI,
  risk: RiskAPI
};

console.log('[ZQ] API 客户端已初始化');

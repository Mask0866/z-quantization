/**
 * 数据同步模块
 * 负责从后端 API 获取实时数据并更新页面
 */

// 数据同步状态
var DATA_SYNC = {
  lastMarketUpdate: null,
  lastFundUpdate: null,
  lastNewsUpdate: null,
  lastSync: null,
  isSyncing: false
};

/**
 * 同步所有数据
 */
async function syncAllData() {
  if (DATA_SYNC.isSyncing) return;
  DATA_SYNC.isSyncing = true;
  
  try {
    // 触发后端同步
    const syncRes = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (syncRes.ok) {
      const data = await syncRes.json();
      DATA_SYNC.lastSync = new Date().toLocaleString('zh-CN');
      console.log('[DataSync] 数据同步完成:', data);
    }
    
    // 刷新各模块数据
    await Promise.all([
      loadMarketData(),
      loadFundData(),
      loadNewsData()
    ]);
    
  } catch (error) {
    console.error('[DataSync] 同步失败:', error);
  } finally {
    DATA_SYNC.isSyncing = false;
  }
}

/**
 * 加载市场数据
 */
async function loadMarketData() {
  try {
    const res = await fetch('/api/market');
    const data = await res.json();
    DATA_SYNC.lastMarketUpdate = new Date().toLocaleString('zh-CN');
    
    // 更新页面显示
    if (typeof updateMarketDisplay === 'function') {
      updateMarketDisplay(data);
    }
    
    console.log('[DataSync] 市场数据已更新');
  } catch (error) {
    console.error('[DataSync] 市场数据加载失败:', error);
  }
}

/**
 * 加载基金数据
 */
async function loadFundData() {
  try {
    const res = await fetch('/api/fund');
    const data = await res.json();
    DATA_SYNC.lastFundUpdate = new Date().toLocaleString('zh-CN');
    
    if (typeof updateFundDisplay === 'function') {
      updateFundDisplay(data);
    }
    
    console.log('[DataSync] 基金数据已更新');
  } catch (error) {
    console.error('[DataSync] 基金数据加载失败:', error);
  }
}

/**
 * 加载新闻数据
 */
async function loadNewsData() {
  try {
    const res = await fetch('/api/news');
    const data = await res.json();
    DATA_SYNC.lastNewsUpdate = new Date().toLocaleString('zh-CN');
    
    if (typeof updateNewsDisplay === 'function') {
      updateNewsDisplay(data);
    }
    
    console.log('[DataSync] 新闻数据已更新');
  } catch (error) {
    console.error('[DataSync] 新闻数据加载失败:', error);
  }
}

/**
 * 加载风险指标
 */
async function loadRiskMetrics() {
  try {
    const res = await fetch('/api/risk/metrics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: 'recalc' })
    });
    const data = await res.json();
    
    if (typeof updateRiskDisplay === 'function') {
      updateRiskDisplay(data);
    }
    
    console.log('[DataSync] 风险指标已更新');
  } catch (error) {
    console.error('[DataSync] 风险指标加载失败:', error);
  }
}

/**
 * 手动触发同步
 */
function triggerManualSync() {
  syncAllData();
}

/**
 * 获取同步状态
 */
function getSyncStatus() {
  return {
    lastSync: DATA_SYNC.lastSync,
    lastMarketUpdate: DATA_SYNC.lastMarketUpdate,
    lastFundUpdate: DATA_SYNC.lastFundUpdate,
    lastNewsUpdate: DATA_SYNC.lastNewsUpdate,
    isSyncing: DATA_SYNC.isSyncing
  };
}

// 导出到全局
window.DATA_SYNC = DATA_SYNC;
window.syncAllData = syncAllData;
window.loadMarketData = loadMarketData;
window.loadFundData = loadFundData;
window.loadNewsData = loadNewsData;
window.loadRiskMetrics = loadRiskMetrics;
window.triggerManualSync = triggerManualSync;
window.getSyncStatus = getSyncStatus;

console.log('[ZQ] 数据同步模块已加载');

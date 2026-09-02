/**
 * Try-On Engine Provider 类型定义
 * 
 * 定义统一的 Provider 接口和返回格式
 */

// Provider 名称常量
const PROVIDER_NAMES = {
  AGNES: 'agnes',
  ALIYUN_TRYON: 'aitryon',
  ALIYUN_TRYON_PLUS: 'aitryon-plus',
  MOCK: 'mock'
};

// 策略名称常量
const STRATEGY_NAMES = {
  FAST: 'FAST',
  BALANCED: 'BALANCED',
  QUALITY: 'QUALITY',
  FAILOVER: 'FAILOVER'
};

// 衣物类别
const GARMENT_CATEGORIES = {
  TOPS: 'tops',
  BOTTOMS: 'bottoms',
  DRESS: 'dress'
};

// Provider 基础接口
class TryOnProvider {
  constructor(config) {
    this.name = config.name;
    this.displayName = config.displayName || config.name;
    this.apiUrl = config.apiUrl || '';
    this.apiKey = config.apiKey || '';
    this.defaultCost = config.defaultCost || 0;
  }

  /**
   * 生成试穿图
   * @param {Object} params
   * @param {string} params.personImage - 人物图 HTTPS URL
   * @param {string} params.garmentImage - 衣物图 HTTPS URL
   * @param {string} params.category - tops|bottoms|dress
   * @param {Object} params.options - 额外参数
   * @returns {Promise<Object>}
   */
  async generate(params) {
    throw new Error(`Provider ${this.name}: generate() not implemented`);
  }

  /**
   * 轮询任务状态
   * @param {string} taskId 
   * @returns {Promise<Object>}
   */
  async poll(taskId) {
    throw new Error(`Provider ${this.name}: poll() not implemented`);
  }

  /**
   * 检查是否配置
   * @returns {boolean}
   */
  isConfigured() {
    return false;
  }

  /**
   * 获取成本估算
   * @returns {number} 单位：分
   */
  getCost() {
    return this.defaultCost;
  }
}

/**
 * 统一返回格式
 */
function createResponse(result) {
  return {
    ok: result.ok !== false,
    provider: result.provider || 'unknown',
    imageUrl: result.imageUrl || result.resultUrl || '',
    cost: result.cost || 0,
    latency: result.latencyMs || 0,
    taskId: result.taskId || '',
    metadata: result.metadata || {}
  };
}

/**
 * 错误响应
 */
function createErrorResponse(error, provider = 'unknown') {
  return {
    ok: false,
    provider,
    imageUrl: '',
    cost: 0,
    latency: 0,
    taskId: '',
    error: error.message || String(error),
    errorCode: error.code || 'UNKNOWN_ERROR',
    metadata: {}
  };
}

/**
 * 阻塞响应（API Key 未配置等）
 */
function createBlockedResponse(reason, provider = 'unknown') {
  return {
    ok: false,
    provider,
    imageUrl: '',
    cost: 0,
    latency: 0,
    taskId: '',
    blocked: true,
    blockReason: reason,
    metadata: {}
  };
}

module.exports = {
  PROVIDER_NAMES,
  STRATEGY_NAMES,
  GARMENT_CATEGORIES,
  TryOnProvider,
  createResponse,
  createErrorResponse,
  createBlockedResponse
};

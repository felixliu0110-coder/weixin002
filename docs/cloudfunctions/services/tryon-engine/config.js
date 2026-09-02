/**
 * Try-On Engine Router 配置
 * 
 * 管理所有 Provider 和 Strategy 的配置
 */

const { PROVIDER_NAMES, STRATEGY_NAMES } = require('./types');

// Provider 配置
const PROVIDER_CONFIG = {
  [PROVIDER_NAMES.AGNES]: {
    name: PROVIDER_NAMES.AGNES,
    displayName: 'Agnes AI',
    apiUrl: 'https://apihub.agnes-ai.com/v1/images/generations',
    apiKeyEnv: 'AGNES_API_KEY',
    defaultCost: 5, // 约 ¥0.05
    model: 'agnes-image-2.1-flash',
    size: '1024x1024'
  },
  [PROVIDER_NAMES.ALIYUN_TRYON]: {
    name: PROVIDER_NAMES.ALIYUN_TRYON,
    displayName: '阿里云 aitryon',
    apiUrl: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/image2image/image-synthesis',
    apiKeyEnv: 'DASHSCOPE_API_KEY',
    defaultCost: 100, // 约 ¥1.00
    model: 'aitryon',
    resolution: -1
  },
  [PROVIDER_NAMES.ALIYUN_TRYON_PLUS]: {
    name: PROVIDER_NAMES.ALIYUN_TRYON_PLUS,
    displayName: '阿里云 aitryon-plus',
    apiUrl: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/image2image/image-synthesis',
    apiKeyEnv: 'DASHSCOPE_API_KEY',
    defaultCost: 300, // 约 ¥3.00
    model: 'aitryon-plus',
    resolution: -1
  },
  [PROVIDER_NAMES.MOCK]: {
    name: PROVIDER_NAMES.MOCK,
    displayName: 'Mock Provider',
    apiUrl: '',
    apiKeyEnv: null,
    defaultCost: 0,
    model: 'mock'
  }
};

// Strategy 配置
const STRATEGY_CONFIG = {
  [STRATEGY_NAMES.FAST]: {
    name: STRATEGY_NAMES.FAST,
    displayName: '快速模式',
    providers: [PROVIDER_NAMES.AGNES],
    description: '低成本、快速响应，适合测试和演示'
  },
  [STRATEGY_NAMES.BALANCED]: {
    name: STRATEGY_NAMES.BALANCED,
    displayName: '均衡模式',
    providers: [PROVIDER_NAMES.ALIYUN_TRYON, PROVIDER_NAMES.AGNES],
    description: '平衡效果与成本，推荐使用'
  },
  [STRATEGY_NAMES.QUALITY]: {
    name: STRATEGY_NAMES.QUALITY,
    displayName: '高质量模式',
    providers: [PROVIDER_NAMES.ALIYUN_TRYON_PLUS, PROVIDER_NAMES.ALIYUN_TRYON],
    description: '最佳效果，成本较高'
  },
  [STRATEGY_NAMES.FAILOVER]: {
    name: STRATEGY_NAMES.FAILOVER,
    displayName: '故障转移模式',
    providers: [
      PROVIDER_NAMES.ALIYUN_TRYON_PLUS,
      PROVIDER_NAMES.ALIYUN_TRYON,
      PROVIDER_NAMES.AGNES
    ],
    description: '依次尝试所有可用 Provider，确保成功率'
  }
};

/**
 * 获取 Provider 配置
 */
function getProviderConfig(providerName) {
  return PROVIDER_CONFIG[providerName] || null;
}

/**
 * 获取 Strategy 配置
 */
function getStrategyConfig(strategyName) {
  return STRATEGY_CONFIG[strategyName] || null;
}

/**
 * 检查 Provider 是否可配置
 */
function isProviderConfigurable(providerName) {
  const config = getProviderConfig(providerName);
  if (!config) return false;
  if (!config.apiKeyEnv) return true; // Mock 无需配置
  return !!process.env[config.apiKeyEnv];
}

/**
 * 获取已配置的 Provider 列表
 */
function getAvailableProviders() {
  return Object.keys(PROVIDER_CONFIG).filter(name => isProviderConfigurable(name));
}

/**
 * 获取可用的 Strategy
 */
function getAvailableStrategies() {
  return Object.keys(STRATEGY_CONFIG).filter(name => {
    const config = getStrategyConfig(name);
    return config.providers.some(p => isProviderConfigurable(p));
  });
}

module.exports = {
  PROVIDER_CONFIG,
  STRATEGY_CONFIG,
  getProviderConfig,
  getStrategyConfig,
  isProviderConfigurable,
  getAvailableProviders,
  getAvailableStrategies
};

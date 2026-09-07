/**
 * Try-On Engine Router 配置
 * 
 * 管理所有 Provider 和 Strategy 的配置
 */

const { PROVIDER_NAMES, STRATEGY_NAMES } = require('./types');

// Provider 配置
const PROVIDER_CONFIG = {
  [PROVIDER_NAMES.ALIYUN_TRYON]: {
    name: PROVIDER_NAMES.ALIYUN_TRYON,
    displayName: '阿里云 aitryon',
    apiUrl: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/image2image/image-synthesis',
    apiKeyEnv: 'DASHSCOPE_API_KEY',
    defaultCost: 20, // 20 分 = ¥0.20/张（官方基础版原价）
    model: 'aitryon',
    resolution: -1
  },
  [PROVIDER_NAMES.ALIYUN_TRYON_PLUS]: {
    name: PROVIDER_NAMES.ALIYUN_TRYON_PLUS,
    displayName: '阿里云 aitryon-plus',
    apiUrl: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/image2image/image-synthesis',
    apiKeyEnv: 'DASHSCOPE_API_KEY',
    defaultCost: 50, // 50 分 = ¥0.50/张（官方 Plus 原价）
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
    providers: [PROVIDER_NAMES.ALIYUN_TRYON],
    description: '单一生产 Provider 路径；真实效果测试前不启用 Engine'
  },
  [STRATEGY_NAMES.BALANCED]: {
    name: STRATEGY_NAMES.BALANCED,
    displayName: '均衡模式',
    providers: [PROVIDER_NAMES.ALIYUN_TRYON],
    description: '单一生产 Provider，优先控制成本与复杂度'
  },
  [STRATEGY_NAMES.QUALITY]: {
    name: STRATEGY_NAMES.QUALITY,
    displayName: '高质量模式',
    providers: [PROVIDER_NAMES.ALIYUN_TRYON_PLUS],
    description: '同一 Provider 的高质量模型变体；仅用于后续质量测试'
  },
  [STRATEGY_NAMES.FAILOVER]: {
    name: STRATEGY_NAMES.FAILOVER,
    displayName: '故障转移模式',
    providers: [PROVIDER_NAMES.ALIYUN_TRYON],
    description: '单一生产 Provider 的故障边界；不跨 Provider 自动切换'
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
function getConfiguredPaidProviderNames() {
  return Object.keys(PROVIDER_CONFIG).filter(name => {
    const config = PROVIDER_CONFIG[name];
    return config && config.apiKeyEnv && isProviderConfigurable(name);
  });
}

function getProviderConfigurationConflict() {
  const configured = getConfiguredPaidProviderNames();
  const aliyunConfigured = configured.includes(PROVIDER_NAMES.ALIYUN_TRYON)
    || configured.includes(PROVIDER_NAMES.ALIYUN_TRYON_PLUS);
  const legacyAgnesConfigured = !!process.env.AGNES_API_KEY;

  // aitryon 与 aitryon-plus 共用同一阿里云百炼 Provider Key，属于同一 Provider 家族，
  // 不应被误判成两个付费 Provider。真正需要阻断的是跨 Provider 并存（如 Agnes + Aliyun）。
  if (legacyAgnesConfigured && aliyunConfigured) {
    return {
      code: 'AI_PROVIDER_CONFIGURATION_CONFLICT',
      providers: ['agnes', 'aliyun']
    };
  }

  return null;
}

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
  getAvailableStrategies,
  getConfiguredPaidProviderNames,
  getProviderConfigurationConflict
};

const { PROVIDER_NAMES, STRATEGY_NAMES } = require('./types');
const PROVIDER_CONFIG = {
  [PROVIDER_NAMES.ALIYUN_TRYON]: {
    name: 'aitryon', displayName: '阿里云 aitryon',
    apiUrl: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/image2image/image-synthesis',
    apiKeyEnv: 'DASHSCOPE_API_KEY', defaultCost: 20, model: 'aitryon', resolution: -1
  }
};
const STRATEGY_CONFIG = {
  [STRATEGY_NAMES.BALANCED]: { name: 'BALANCED', displayName: '均衡模式', providers: ['aitryon'], description: 'V1 唯一生产 Provider' }
};
function getProviderConfig(name) { return PROVIDER_CONFIG[name] || null; }
function getStrategyConfig(name) { return STRATEGY_CONFIG[name] || null; }
function isProviderConfigurable(name) { const c = getProviderConfig(name); return !!(c && process.env[c.apiKeyEnv]); }
function getProviderConfigurationConflict() {
  if (process.env.DASHSCOPE_API_KEY && process.env.AGNES_API_KEY) return { code: 'AI_PROVIDER_CONFIGURATION_CONFLICT', providers: ['agnes', 'aliyun'] };
  return null;
}
function getAvailableProviders() { return Object.keys(PROVIDER_CONFIG).filter(isProviderConfigurable); }
function getAvailableStrategies() { return Object.keys(STRATEGY_CONFIG).filter(n => STRATEGY_CONFIG[n].providers.some(isProviderConfigurable)); }
module.exports = { PROVIDER_CONFIG, STRATEGY_CONFIG, getProviderConfig, getStrategyConfig, isProviderConfigurable, getAvailableProviders, getAvailableStrategies, getProviderConfigurationConflict };

/**
 * Try-On Engine Router
 * 
 * 支持 FAST / BALANCED / QUALITY / FAILOVER 四种策略
 */

const { STRATEGY_NAMES, createResponse, createErrorResponse } = require('./types');
const { getStrategyConfig, getProviderConfig, isProviderConfigurable } = require('./config');
const AgnesProvider = require('./providers/agnes');
const AliyunTryOnProvider = require('./providers/aliyun');
const MockProvider = require('./providers/mock');

class TryOnRouter {
  constructor() {
    this.providers = new Map();
    this.registerProviders();
  }

  /**
   * 注册所有 Provider 实例
   */
  registerProviders() {
    // Agnes
    if (isProviderConfigurable('agnes')) {
      this.providers.set('agnes', new AgnesProvider());
    }
    
    // Aliyun aitryon
    if (isProviderConfigurable('aitryon')) {
      this.providers.set('aitryon', new AliyunTryOnProvider('aitryon'));
    }
    
    // Aliyun aitryon-plus
    if (isProviderConfigurable('aitryon-plus')) {
      this.providers.set('aitryon-plus', new AliyunTryOnProvider('aitryon-plus'));
    }
    
    // Mock（始终注册）
    this.providers.set('mock', new MockProvider());
  }

  /**
   * 生成试穿图
   * @param {Object} params 
   * @param {string} params.personImage - 人物图 URL
   * @param {string} params.garmentImage - 衣物图 URL
   * @param {string} params.category - tops|bottoms|dress
   * @param {string} strategy - FAST|BALANCED|QUALITY|FAILOVER
   * @returns {Promise<Object>}
   */
  async generate(params, strategy = STRATEGY_NAMES.BALANCED) {
    const t0 = Date.now();
    
    // 获取策略配置
    const strategyConfig = getStrategyConfig(strategy);
    if (!strategyConfig) {
      return createErrorResponse(new Error(`Unknown strategy: ${strategy}`));
    }

    // FAILOVER 策略：依次尝试
    if (strategy === STRATEGY_NAMES.FAILOVER) {
      return await this.generateFailover(params, strategyConfig.providers);
    }

    // 其他策略：使用第一个可用 Provider
    const providerName = strategyConfig.providers[0];
    const provider = this.providers.get(providerName);
    
    if (!provider) {
      return createErrorResponse(new Error(`Provider ${providerName} not available`));
    }

    if (!provider.isConfigured()) {
      return createResponse({
        ok: false,
        provider: providerName,
        blocked: true,
        blockReason: `Provider ${providerName} not configured`
      });
    }

    try {
      const result = await provider.generate(params);
      result.latency = Date.now() - t0;
      return result;
    } catch (e) {
      return createErrorResponse(e, providerName);
    }
  }

  /**
   * FAILOVER 策略：依次尝试多个 Provider
   */
  async generateFailover(params, providerNames) {
    const t0 = Date.now();
    let lastError = null;

    for (const providerName of providerNames) {
      const provider = this.providers.get(providerName);
      
      if (!provider || !provider.isConfigured()) {
        continue;
      }

      try {
        const result = await provider.generate(params);
        if (result.ok) {
          result.latency = Date.now() - t0;
          result.metadata = {
            ...result.metadata,
            failover: false,
            attemptedProviders: providerNames.length
          };
          return result;
        }
        lastError = result.error || new Error('Provider returned error');
      } catch (e) {
        lastError = e;
      }
    }

    // 所有 Provider 都失败
    return createErrorResponse(lastError || new Error('All providers failed'), 'failover');
  }

  /**
   * 获取可用 Provider 列表
   */
  getAvailableProviders() {
    const available = [];
    for (const [name, provider] of this.providers) {
      if (provider.isConfigured()) {
        available.push({
          name,
          displayName: provider.displayName,
          cost: provider.getCost()
        });
      }
    }
    return available;
  }

  /**
   * 获取当前配置状态
   */
  getStatus() {
    return {
      providers: Array.from(this.providers.entries()).map(([name, p]) => ({
        name,
        configured: p.isConfigured()
      })),
      strategies: Object.keys(STRATEGY_NAMES).map(name => {
        const config = getStrategyConfig(name);
        return {
          name,
          available: config.providers.some(p => isProviderConfigurable(p))
        };
      })
    };
  }
}

// 单例
let routerInstance = null;

function getRouter() {
  if (!routerInstance) {
    routerInstance = new TryOnRouter();
  }
  return routerInstance;
}

module.exports = { TryOnRouter, getRouter };

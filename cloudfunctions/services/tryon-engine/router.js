/**
 * Try-On Engine Router
 *
 * 职责边界（Phase 4.3-A 收口）：
 *   Router 只负责——
 *     1. 检查 strategy 是否合法
 *     2. 根据 strategy 配置列出候选 Provider
 *     3. 选择一个「已配置(isConfigured)」的 Provider
 *     4. 将 normalizeContext() 已经处理好的「标准 Try-On Context 原样」
 *        交给 provider.generate(ctx)
 *     5. 统一返回结果
 *
 * Router 不再负责（这些责任已下沉到对应层）：
 *   - 选择人物图片           → context.normalizePerson（形成 person.personImage）
 *   - 选择 / 过滤 garment    → context.normalizeGarments + Engine 校验
 *   - category 业务枚举映射  → category.toTryOnCategory
 *   - 组装 personImage/garmentImage/category 旧字段 → 由 context.js 旧参数兼容统一转换
 *   - 自动 Mock 兜底         → Mock 仅供测试/开发显式调用，不作为生产成功兜底
 *
 * 标准 Context 是唯一上游输入合同；Provider 自己负责将其映射为自己 API 的 payload。
 */

const { STRATEGY_NAMES, createResponse, createErrorResponse } = require('./types');
const { getStrategyConfig, isProviderConfigurable } = require('./config');
const AgnesProvider = require('./providers/agnes');
const AliyunTryOnProvider = require('./providers/aliyun');
const MockProvider = require('./providers/mock');

// 注册所有 Provider「实例」，但「是否可用」完全由 provider.isConfigured() 决定。
// Mock 仍被实例化，可供测试显式调用；但不会在真实生成路径中被自动兜底。

class TryOnRouter {
  constructor() {
    this.providers = new Map();
    this.registerProviders();
  }

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
    // Mock：始终实例化（供测试 / 本地开发显式使用），但不参与生产自动兜底
    this.providers.set('mock', new MockProvider());
  }

  /**
   * 生成试穿图。
   * @param {Object} ctx - 标准 Try-On Context（已由 normalizeContext + validateContext 处理）
   * @param {string} strategy - FAST|BALANCED|QUALITY|FAILOVER
   * @returns {Promise<Object>} 统一响应格式
   */
  async generate(ctx, strategy = STRATEGY_NAMES.BALANCED) {
    const t0 = Date.now();

    const strategyConfig = getStrategyConfig(strategy);
    if (!strategyConfig) {
      return createErrorResponse(new Error(`Unknown strategy: ${strategy}`));
    }

    // FAILOVER：在「策略配置的候选列表」内依次尝试，不额外追加 mock
    if (strategy === STRATEGY_NAMES.FAILOVER) {
      return await this.generateFailover(ctx, strategyConfig.providers);
    }

    // 其它策略：按配置顺序选第一个已配置的候选 Provider。
    // 无可用真实 Provider 时 → 明确失败，不 fallback 到 mock 伪成功。
    const candidateName = strategyConfig.providers.find((name) => {
      const p = this.providers.get(name);
      return p && p.isConfigured();
    });

    if (!candidateName) {
      return createErrorResponse(
        new Error(`No configured provider available (strategy=${strategy}). ` +
          `当前无可用真实 Provider，Engine 不会以 Mock 伪造成功结果。`),
        'engine'
      );
    }

    const provider = this.providers.get(candidateName);
    return await this.invokeProvider(provider, candidateName, ctx, t0);
  }

  /**
   * 统一调用入口：将「标准 Context 原样」交给 provider.generate。
   * 不在此处重新选择人物图 / garment / category。
   */
  async invokeProvider(provider, providerName, ctx, t0) {
    try {
      const result = await provider.generate(ctx);
      if (result && t0) {
        result.latency = Date.now() - t0;
      }
      return result;
    } catch (e) {
      return createErrorResponse(e, providerName);
    }
  }

  /**
   * FAILOVER：在「策略配置的 Provider 列表」内依次尝试。
   * 规则：
   *   - 只尝试 isConfigured() 的 Provider
   *   - 不追加 mock 作为兜底
   *   - 某个 Provider 返回 ok 即返回；全部失败则返回明确错误
   */
  async generateFailover(ctx, providerNames) {
    const t0 = Date.now();
    let lastError = null;

    for (const providerName of providerNames) {
      const provider = this.providers.get(providerName);
      if (!provider || !provider.isConfigured()) {
        continue;
      }

      const result = await this.invokeProvider(provider, providerName, ctx, t0);
      if (result && result.ok) {
        result.metadata = {
          ...(result.metadata || {}),
          failover: false,
          attemptedProviders: providerNames.length,
        };
        return result;
      }
      lastError = (result && result.error) || new Error(`${providerName} returned error`);
    }

    // 所有已配置候选均失败 / 无可配置候选
    return createErrorResponse(lastError || new Error('All providers failed'), 'failover');
  }

  /**
   * 获取可用 Provider 列表（isConfigured() 为 true 的）
   */
  getAvailableProviders() {
    const available = [];
    for (const [name, provider] of this.providers) {
      if (provider.isConfigured()) {
        available.push({
          name,
          displayName: provider.displayName,
          cost: provider.getCost(),
        });
      }
    }
    return available;
  }

  getStatus() {
    return {
      providers: Array.from(this.providers.entries()).map(([name, p]) => ({
        name,
        configured: p.isConfigured(),
      })),
      strategies: Object.keys(STRATEGY_NAMES).map((name) => {
        const config = getStrategyConfig(name);
        return {
          name,
          available: config.providers.some((p) => isProviderConfigurable(p)),
        };
      }),
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

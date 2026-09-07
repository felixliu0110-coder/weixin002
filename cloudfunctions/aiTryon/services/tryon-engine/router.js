const { STRATEGY_NAMES, createResponse, createErrorResponse } = require('./types');
const { getStrategyConfig, isProviderConfigurable, getProviderConfigurationConflict } = require('./config');
const AliyunTryOnProvider = require('./providers/aliyun');
class TryOnRouter {
  constructor() { this.providers = new Map([['aitryon', new AliyunTryOnProvider('aitryon')]]); }
  _provider() { return this.providers.get('aitryon'); }
  _guard() {
    const conflict = getProviderConfigurationConflict();
    if (conflict) return createErrorResponse(Object.assign(new Error('同时配置了 DashScope 与 Agnes，V1 拒绝启动 Provider'), { code: conflict.code }), 'engine');
    if (!isProviderConfigurable('aitryon')) return createErrorResponse(Object.assign(new Error('DASHSCOPE_API_KEY 未配置'), { code: 'PROVIDER_NOT_CONFIGURED' }), 'aitryon');
    return null;
  }
  async submit(ctx, strategy = STRATEGY_NAMES.BALANCED) {
    const blocked = this._guard(); if (blocked) return blocked;
    const sc = getStrategyConfig(strategy); if (!sc) return createErrorResponse(Object.assign(new Error('Unsupported strategy'), { code: 'UNSUPPORTED_STRATEGY' }), 'engine');
    const p = this._provider();
    try { return createResponse(await p.submitOnly(ctx)); } catch (e) { return createErrorResponse(e, 'aitryon'); }
  }
  async getTaskStatus(providerName, providerTaskId) {
    const blocked = this._guard(); if (blocked && blocked.errorCode === 'AI_PROVIDER_CONFIGURATION_CONFLICT') return blocked;
    if (providerName !== 'aitryon') return createErrorResponse(Object.assign(new Error('V1 仅支持 aitryon task'), { code: 'PROVIDER_NOT_SUPPORTED' }), 'engine');
    if (!providerTaskId) return createErrorResponse(Object.assign(new Error('provider_task_id 缺失'), { code: 'INVALID_PROVIDER_TASK_ID' }), 'aitryon');
    try { return createResponse(await this._provider().getTaskStatus(providerTaskId)); } catch (e) { return createErrorResponse(e, 'aitryon'); }
  }
  getStatus() { return { providers: [{ name: 'aitryon', configured: isProviderConfigurable('aitryon') }], strategies: [{ name: 'BALANCED', available: isProviderConfigurable('aitryon') }] }; }
  getAvailableProviders() { return isProviderConfigurable('aitryon') ? [{ name: 'aitryon', displayName: '阿里云 aitryon', cost: this._provider().getCost() }] : []; }
}
let instance; function getRouter() { if (!instance) instance = new TryOnRouter(); return instance; }
module.exports = { TryOnRouter, getRouter };

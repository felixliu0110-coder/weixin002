/**
 * Try-On Engine Provider 基础类
 * 
 * 定义所有 Provider 必须实现的接口
 */

const { TryOnProvider, createResponse, createErrorResponse, createBlockedResponse, PROVIDER_NAMES } = require('../types');

class BaseTryOnProvider extends TryOnProvider {
  constructor(config) {
    super(config);
    this.maxRetries = config.maxRetries || 1;
    this.timeoutMs = config.timeoutMs || 120000;
  }

  /**
   * 统一的 generate 接口实现模板
   */
  async generate(params) {
    const t0 = Date.now();
    
    // 检查是否配置
    if (!this.isConfigured()) {
      return createBlockedResponse(`Provider ${this.name} not configured`, this.name);
    }

    // 参数校验
    const validation = this.validateParams(params);
    if (!validation.valid) {
      return createErrorResponse(new Error(validation.error), this.name);
    }

    try {
      const result = await this._generateInternal(params);
      const latencyMs = Date.now() - t0;
      
      return createResponse({
        ok: true,
        provider: this.name,
        imageUrl: result.url,
        taskId: result.taskId || '',
        cost: result.cost || this.getCost(),
        latencyMs,
        metadata: {
          model: this.getConfig().model,
          category: params.category,
          ...result.metadata
        }
      });
    } catch (e) {
      const latencyMs = Date.now() - t0;
      return createErrorResponse(e, this.name);
    }
  }

  /**
   * 子类实现具体生成逻辑
   */
  async _generateInternal(params) {
    throw new Error(`${this.name}._generateInternal() not implemented`);
  }

  /**
   * 参数校验（子类可覆盖）
   */
  validateParams(params) {
    if (!params.personImage || typeof params.personImage !== 'string') {
      return { valid: false, error: 'personImage is required' };
    }
    if (!params.garmentImage || typeof params.garmentImage !== 'string') {
      return { valid: false, error: 'garmentImage is required' };
    }
    if (!['tops', 'bottoms', 'dress'].includes(params.category)) {
      return { valid: false, error: 'category must be tops|bottoms|dress' };
    }
    return { valid: true };
  }

  /**
   * 获取配置
   */
  getConfig() {
    return {
      name: this.name,
      model: 'default'
    };
  }
}

module.exports = BaseTryOnProvider;

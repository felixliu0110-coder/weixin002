/**
 * Try-On Engine Provider 基础类
 *
 * 子类 Provider 只需实现真实调用逻辑。
 * category 已由 Engine 上层完成标准化，Provider 不再重复解析业务枚举。
 */

const {
  TryOnProvider, createResponse, createErrorResponse, createBlockedResponse,
} = require('../types');

class BaseTryOnProvider extends TryOnProvider {
  constructor(config) {
    super(config);
    this.maxRetries = config.maxRetries || 1;
    this.timeoutMs = config.timeoutMs || 120000;
  }

  /**
   * 带配置/重试包装的 generate
   */
  async generate(params = {}) {
    const t0 = Date.now();

    if (!this.isConfigured()) {
      return createBlockedResponse(`Provider ${this.name} not configured`, this.name);
    }

    // Engine 上层已完成 category mapping；此处仅做 Provider 通用校验
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
          // 透传已标准化的 category（可能来自 garments[0]）
          category: params.category || (params.garments && params.garments[0] && params.garments[0].category) || null,
          ...(result.metadata || {}),
        },
      });
    } catch (e) {
      const latencyMs = Date.now() - t0;
      return createErrorResponse(e, this.name);
    }
  }

  /**
   * 子类实现：真实调用
   */
  async _generateInternal(/* params */) {
    throw new Error(`${this.name}._generateInternal() not implemented`);
  }

  /**
   * Provider 通用参数校验（Engine 已标准化后的 Context）。
   * 必须存在：person 主图（originalPhoto 或兼容 personImage）+ garments 至少一件。
   */
  validateParams(params) {
    const personImg = (params.person && (params.person.originalPhoto || params.person.personImage)) || params.personImage;
    if (!personImg || typeof personImg !== 'string') {
      return { valid: false, error: 'person.originalPhoto (or legacy personImage) is required' };
    }
    const garms = params.garments && Array.isArray(params.garments) ? params.garments : (params.garmentImage ? [{ image: params.garmentImage }] : []);
    if (garms.length === 0) {
      return { valid: false, error: 'garments.length >= 1 is required' };
    }
    return { valid: true };
  }

  getConfig() {
    return {
      name: this.name,
      model: 'default',
    };
  }
}

module.exports = BaseTryOnProvider;

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
      const person = params.person && typeof params.person === 'object' ? params.person : {};
      return createResponse({
        ok: true,
        provider: this.name,
        imageUrl: result.url,
        taskId: result.taskId || '',
        cost: result.cost || this.getCost(),
        latencyMs,
        metadata: {
          model: this.getConfig().model,
          // 透传已标准化的 category（来自 garments[0]）
          category: (params.garments && params.garments[0] && params.garments[0].category) || null,
          // personSourceType 由 Engine/context.normalizePerson 决定，统一在 Engine 层记录
          ...(person.personSourceType ? { personSourceType: person.personSourceType } : {}),
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
   * Provider 通用参数校验（接收 Engine 已标准化的「标准 Try-On Context」）。
   *
   * 责任边界（Phase 4.3-A）：
   *   - 人物主图统一为 ctx.person.personImage（由 Engine/context.normalizePerson 决定，
   *     originalPhoto > frontPhoto > anchorImage）。Provider 不得再次自行选图，
   *     禁止 originalPhoto || personImage 这类重新解释。
   *   - 单件 garment 统一为 ctx.garments[0]（Engine 已校验恰好一件且品类受支持）。
   *     Provider 自行从中提取 image / category 以映射自身 API payload。
   */
  validateParams(ctx = {}) {
    const person = ctx.person && typeof ctx.person === 'object' ? ctx.person : {};
    const personImg = person.personImage;
    if (!personImg || typeof personImg !== 'string') {
      return { valid: false, error: 'person.personImage is required (Engine must resolve it before Provider)' };
    }
    const garms = Array.isArray(ctx.garments) ? ctx.garments : [];
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

/**
 * Try-On Engine 入口
 *
 * 输入合同（标准 Try-On Context）：
 *   {
 *     person: { assetId, originalPhoto, frontPhoto, anchorImage, bodyProfile },
 *     garments: [{ garmentId, image, category, name, profile }],
 *     options: { strategy, mode, preserveFace }
 *   }
 *
 * 兼容旧调用：generate({ personImage, garmentImage, category }, strategy)
 * 内部统一转换为标准 Context；新代码优先使用标准 Context。
 */

const { getRouter } = require('./router');
const { STRATEGY_NAMES } = require('./types');
const { normalizeContext, validateContext } = require('./context');
const { ERROR_UNSUPPORTED } = require('./category');

/**
 * 生成试穿结果
 * @param {Object} params - 标准 Try-On Context 或旧参数
 * @param {string} strategy - FAST|BALANCED|QUALITY|FAILOVER
 * @returns {Promise<Object>}
 */
async function generate(params = {}, strategy = STRATEGY_NAMES.BALANCED) {
  const router = getRouter();

  // 1. 参数规范化（含旧参数兼容）
  const ctx = normalizeContext(params);

  // 2. 若全部 garments 品类均不支持，优先返回明确错误（早于通用校验）
  const unsupported = ctx.garments.filter((g) => g.category === ERROR_UNSUPPORTED);
  if (ctx.garments.length > 0 && unsupported.length === ctx.garments.length) {
    return {
      ok: false,
      provider: 'engine',
      imageUrl: '',
      cost: 0,
      latencyMs: 0,
      error: 'UNSUPPORTED_TRYON_CATEGORY',
      errorCode: 'UNSUPPORTED_TRYON_CATEGORY',
      metadata: { unsupportedCategories: unsupported.map((g) => g.sourceCategory) },
    };
  }

  // 3. 参数校验（至少一件有效 garment + person 图片）
  const v = validateContext(ctx);
  if (!v.valid) {
    return {
      ok: false,
      provider: 'engine',
      imageUrl: '',
      cost: 0,
      latencyMs: 0,
      error: v.errors.join('; '),
      errorCode: 'INVALID_TRYON_CONTEXT',
      metadata: {},
    };
  }

  // 4. Provider 可用性检查 + Router + Provider
  //    Router 负责 strategy -> provider 选择；Provider 仅处理已准备好的标准 Context
  const result = await router.generate(ctx, strategy);

  // 透传 personSourceType 到 metadata
  if (result && ctx.person.personSourceType) {
    result.metadata = result.metadata || {};
    result.metadata.personSourceType = ctx.person.personSourceType;
  }
  return result;
}

function getStatus() {
  const router = getRouter();
  return router.getStatus();
}

function getAvailableProviders() {
  const router = getRouter();
  return router.getAvailableProviders();
}

module.exports = {
  generate,
  getStatus,
  getAvailableProviders,
  // 兼容别名
  tryOn: { generate },
  // 暴露子模块便于测试
  _normalizeContext: normalizeContext,
  _validateContext: validateContext,
};

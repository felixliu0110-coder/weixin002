/**
 * Try-On category mapper
 *
 * 将生产业务枚举（中文）规范化为 Try-On Engine 内部枚举。
 * 生产 garments.category 仍保持原有中文枚举，不做破坏性变更。
 */

const TRYON_CATEGORY = {
  TOPS: 'tops',
  BOTTOMS: 'bottoms',
};

const ERROR_UNSUPPORTED = 'UNSUPPORTED_TRYON_CATEGORY';

/**
 * 中文业务枚举 -> Try-On 内部枚举
 *   上衣 -> tops
 *   裤子 -> bottoms
 *   连衣裙（未来）-> dress  // 当前生产无此枚举，预留
 *
 * 头饰 / 鞋子 / 其他：当前不参与服装 VTON，明确报错。
 */
function toTryOnCategory(category) {
  if (category == null) return ERROR_UNSUPPORTED;
  const v = String(category).trim();

  if (v === '上衣') return TRYON_CATEGORY.TOPS;
  if (v === '裤子') return TRYON_CATEGORY.BOTTOMS;
  if (v === '连衣裙') return 'dress'; // 预留，尚未在生产枚举中

  // 已规范化的内部值直接透传（兼容下层 / 测试）
  if (v === TRYON_CATEGORY.TOPS || v === TRYON_CATEGORY.BOTTOMS || v === 'dress') {
    return v;
  }

  return ERROR_UNSUPPORTED;
}

/**
 * 当前生产试穿链真正支持的品类。
 * 仅 tops / bottoms。dress 虽已在映射层预留，但尚未进入生产生成链，
 * 必须经真实接入验证后才可放行，因此 isSupportedForTryOn 明确排除 dress。
 */
const PRODUCTION_TRYON_CATEGORIES = new Set([
  TRYON_CATEGORY.TOPS,
  TRYON_CATEGORY.BOTTOMS,
]);

/**
 * 判断某个「已规范化」的 category（tops/bottoms/dress/UNSUPPORTED_TRYON_CATEGORY）
 * 是否可以进入当前生产试穿生成链。
 *
 * - tops / bottoms → true
 * - dress → false（已预留定义，但未经验证，不允许进入 Provider）
 * - UNSUPPORTED_TRYON_CATEGORY / 其它 → false
 */
function isSupportedForTryOn(category) {
  return PRODUCTION_TRYON_CATEGORIES.has(category);
}

/**
 * 将单个 garment 的 category 标准化。
 * 输出新增 sourceCategory（原始业务枚举）与规范化后的 category。
 */
function normalizeGarmentCategory(garment) {
  if (!garment) return garment;
  const sourceCategory = garment.category;
  const mapped = toTryOnCategory(sourceCategory);
  return {
    ...garment,
    sourceCategory: sourceCategory || undefined,
    category: mapped, // 不支持品类保留 ERROR_UNSUPPORTED，供下游统一过滤
  };
}

module.exports = {
  TRYON_CATEGORY,
  ERROR_UNSUPPORTED,
  toTryOnCategory,
  isSupportedForTryOn,
  normalizeGarmentCategory,
};

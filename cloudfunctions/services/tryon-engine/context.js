/**
 * Try-On Context 规范化
 *
 * 将外部输入（标准 Try-On Context 或旧参数）规范为统一结构：
 *   { person, garments, options }
 *
 * 人物图片选择优先级：
 *   1) person.originalPhoto
 *   2) person.frontPhoto
 *   3) person.anchorImage
 *   avatar composite / three_view_composite 不作为默认 Try-On 输入。
 *
 * 旧调用兼容：
 *   generate({ personImage, garmentImage, category }, strategy)
 *   内部转换为标准 Context；新代码应优先使用标准 Context。
 */

const { normalizeGarmentCategory, ERROR_UNSUPPORTED, isSupportedForTryOn } = require('./category');

const PERSON_SOURCE_PRIORITY = ['originalPhoto', 'frontPhoto', 'anchorImage'];

function normalizePerson(person = {}) {
  if (!person || typeof person !== 'object') {
    return { _empty: true };
  }
  // 选择主人物图片：按优先级取第一个存在且为字符串(非空)的字段
  let selectedKey = null;
  let selectedUrl = null;
  for (const key of PERSON_SOURCE_PRIORITY) {
    const v = person[key];
    if (typeof v === 'string' && v.length > 0) {
      selectedKey = key;
      selectedUrl = v;
      break;
    }
  }
  return {
    assetId: person.assetId || null,
    originalPhoto: person.originalPhoto || null,
    frontPhoto: person.frontPhoto || null,
    anchorImage: person.anchorImage || null,
    bodyProfile: person.bodyProfile || null,
    // 主人物依据（供 Provider 直接使用）
    personImage: selectedUrl,
    personSourceType: selectedKey
      ? selectedKey.replace('Photo', '_photo').replace('anchorImage', 'anchor_image')
      : null,
  };
}

function normalizeGarments(input) {
  const arr = Array.isArray(input) ? input : (input ? [input] : []);
  return arr
    .filter((g) => g && typeof g === 'object')
    .map((g) => {
      const norm = normalizeGarmentCategory(g);
      return {
        garmentId: g.garmentId || g.garment_id || null,
        image: g.image || g.garmentImage || null,
        category: norm.category, // 已标准化为 tops/bottoms 或原始值（若不支持）
        sourceCategory: norm.sourceCategory,
        name: g.name || null,
        profile: g.profile || null,
      };
    });
}

function normalizeOptions(options = {}) {
  return {
    strategy: options.strategy || null,
    mode: options.mode || 'image',
    preserveFace: options.preserveFace !== false, // 默认 true
    background: options.background || 'keep',
  };
}

/**
 * 主入口：将任意合法输入规范为统一 Context。
 * 支持：
 *   - 标准 Context：{ person, garments[], options }
 *   - 旧参数：{ personImage, garmentImage, category }
 */
function normalizeContext(params = {}) {
  // 旧参数兼容
  if (params.personImage && !params.person) {
    const legacy = {
      person: {
        originalPhoto: params.personImage,
        bodyProfile: params.bodyProfile || null,
      },
      garments: params.garmentImage
        ? [{ image: params.garmentImage, category: params.category || null }]
        : [],
      options: params.options || {},
    };
    // 若旧参数里带了 garments 数组（部分迁移场景），保留
    if (Array.isArray(params.garments) && params.garments.length) {
      legacy.garments = params.garments;
    }
    return buildContext(legacy);
  }

  return buildContext(params);
}

function buildContext(params) {
  const person = normalizePerson(params.person || {});
  const garments = normalizeGarments(params.garments || []);
  const options = normalizeOptions(params.options || {});
  return { person, garments, options };
}

/**
 * 校验规范化后的 Context 是否满足 Engine 基础要求。
 *   - person.personImage 必须存在（即 original/front/anchor 至少一个）
 *   - Image MVP：单次试穿当前只支持「恰好一件」目标 garment，
 *     多件不偷偷取第一件，而是明确拒绝（未来多衣物组合另作功能）
 *   - 该单件 garment 的 category 必须属于当前生产支持范围（tops/bottoms），
 *     dress 虽已预留映射但暂不进入生成链
 */
function validateContext(ctx) {
  const errors = [];
  if (!ctx.person.personImage) {
    errors.push('person.originalPhoto / frontPhoto / anchorImage 至少一个为有效图片');
  }
  // Image MVP：精确一件。0 件或 >=2 件均明确拒绝，避免悄悄只试穿第一件。
  if (ctx.garments.length === 0) {
    errors.push('garments 至少提供一件');
  } else if (ctx.garments.length > 1) {
    errors.push('当前单次试穿仅支持一件 garment；请勿在一次请求中传入多件（MULTI_GARMENT_NOT_SUPPORTED）');
  } else {
    const g = ctx.garments[0];
    if (!g.category || g.category === ERROR_UNSUPPORTED) {
      errors.push('garment 品类不支持试穿（UNSUPPORTED_TRYON_CATEGORY）');
    } else if (!isSupportedForTryOn(g.category)) {
      // 规范化后为 dress 或其它预留值：当前生产不可试穿
      errors.push(`当前生产暂不支持该品类试穿：${g.category || ''}（UNSUPPORTED_TRYON_CATEGORY）`);
    }
  }
  return { valid: errors.length === 0, errors };
}

module.exports = {
  PERSON_SOURCE_PRIORITY,
  normalizeContext,
  normalizePerson,
  normalizeGarments,
  normalizeOptions,
  validateContext,
};

/**
 * Garment Asset 类型定义
 *
 * garment_profiles 是 garments（衣物实体）的理解扩展资料。
 * 一件衣物最多一个 profile。
 *
 * 允许字段：garment_id / user_id / category / color / style / material /
 * pattern / season / occasion / ai_tags / features / source / status /
 * created_at / updated_at
 * 禁止字段（仍属 garments）：name / original_file_id / size_label /
 * measurements / type
 */

// 衣物类别
const GARMENT_CATEGORY = {
  TOP: 'tops',
  BOTTOM: 'bottoms',
  DRESS: 'dress',
  ACCESSORY: 'accessory',
  SHOES: 'shoes',
  OTHER: 'other'
};

// 图案类型
const PATTERN_TYPE = {
  SOLID: 'solid',
  STRIPE: 'stripe',
  PATTERN: 'pattern',
  LOGO: 'logo',
  FLORAL: 'floral',
  PLAID: 'plaid',
  POLKA_DOT: 'polka_dot',
  GRADIENT: 'gradient'
};

// 风格类型
const STYLE_TYPE = {
  CASUAL: 'casual',
  FORMAL: 'formal',
  SPORTS: 'sports',
  VINTAGE: 'vintage',
  MODERN: 'modern',
  BOHEMIAN: 'bohemian',
  MINIMALIST: 'minimalist',
  STREETWEAR: 'streetwear'
};

// 材质类型
const MATERIAL_TYPE = {
  COTTON: 'cotton',
  DENIM: 'denim',
  SILK: 'silk',
  WOOL: 'wool',
  LINEN: 'linen',
  LEATHER: 'leather',
  SYNTHETIC: 'synthetic',
  BLEND: 'blend',
  KNIT: 'knit',
  CHIFFON: 'chiffon',
  VELVET: 'velvet',
  OTHER: 'other'
};

// 季节类型
const SEASON_TYPE = {
  SPRING: 'spring',
  SUMMER: 'summer',
  AUTUMN: 'autumn',
  WINTER: 'winter',
  ALL_SEASON: 'all_season'
};

// 场合类型
const OCCASION_TYPE = {
  DAILY: 'daily',
  WORK: 'work',
  DATE: 'date',
  PARTY: 'party',
  SPORTS: 'sports',
  FORMAL: 'formal',
  CASUAL: 'casual',
  TRAVEL: 'travel'
};

// 颜色类型（简化）
const COLOR_TYPE = {
  BLACK: 'black',
  WHITE: 'white',
  RED: 'red',
  BLUE: 'blue',
  GREEN: 'green',
  YELLOW: 'yellow',
  PURPLE: 'purple',
  PINK: 'pink',
  BROWN: 'brown',
  GRAY: 'gray',
  BEIGE: 'beige',
  NAVY: 'navy',
  MULTICOLOR: 'multicolor'
};

// 资产来源 / 状态
const PROFILE_SOURCE = { MANUAL: 'manual' };
const ASSET_STATUS = { PENDING: 'pending', PROCESSING: 'processing', READY: 'ready', FAILED: 'failed' };

// 衣物数字档案 schema（仅扩展资料字段）
const GARMENT_PROFILE_SCHEMA = {
  garment_id: { type: 'string', required: true, description: '关联的 garments._id' },
  user_id: { type: 'string', required: true, description: '用户 OPENID' },
  category: { type: 'string', enum: Object.values(GARMENT_CATEGORY), description: '衣物类别（初始化自 garments.category）' },
  color: { type: 'array', items: { type: 'string' }, description: '主色调列表' },
  style: { type: 'string', enum: Object.values(STYLE_TYPE), description: '风格类型' },
  material: { type: 'string', enum: Object.values(MATERIAL_TYPE), description: '材质类型' },
  pattern: { type: 'string', enum: Object.values(PATTERN_TYPE), description: '图案类型' },
  season: { type: 'array', items: { type: 'string' }, description: '适用季节' },
  occasion: { type: 'array', items: { type: 'string' }, description: '适用场合' },
  ai_tags: { type: 'array', items: { type: 'string' }, description: 'AI 标签（预留，不在此阶段推断）' },
  features: {
    silhouette: { type: 'string', description: '廓形' },
    fit: { type: 'string', description: '版型' },
    length: { type: 'string', description: '衣长' },
    sleeve: { type: 'string', description: '袖长' },
    neckline: { type: 'string', description: '领型' }
  },
  source: { type: 'string', description: '来源，当前固定 manual' },
  status: { type: 'string', enum: Object.values(ASSET_STATUS), description: '状态' },
  created_at: { type: 'number', description: '创建时间' },
  updated_at: { type: 'number', description: '更新时间' }
};

// 验证函数
function validateGarmentProfile(data) {
  const errors = [];
  if (!data.garment_id || typeof data.garment_id !== 'string') {
    errors.push('garment_id is required and must be string');
  }
  if (!data.user_id || typeof data.user_id !== 'string') {
    errors.push('user_id is required and must be string');
  }
  if (data.category && !Object.values(GARMENT_CATEGORY).includes(data.category)) {
    errors.push('category must be one of: ' + Object.values(GARMENT_CATEGORY).join(','));
  }
  if (data.status && !Object.values(ASSET_STATUS).includes(data.status)) {
    errors.push('status must be one of: ' + Object.values(ASSET_STATUS).join(','));
  }
  // 拒绝越界字段（属于 garments）
  const forbidden = ['name', 'original_file_id', 'size_label', 'measurements', 'type'];
  for (const f of forbidden) {
    if (f in data) errors.push('field "' + f + '" is not allowed in garment_profiles (belongs to garments)');
  }
  return { valid: errors.length === 0, errors };
}

// 创建默认文档（source=manual, status=ready）
function createDefaultDoc(garmentId, openid, options = {}) {
  const now = Date.now();
  const doc = {
    garment_id: garmentId,
    user_id: openid,
    category: options.category || '',
    source: PROFILE_SOURCE.MANUAL,
    status: ASSET_STATUS.READY,
    color: options.color || [],
    style: options.style || '',
    material: options.material || '',
    pattern: options.pattern || '',
    season: options.season || [],
    occasion: options.occasion || [],
    ai_tags: options.ai_tags || [],
    features: options.features || {},
    created_at: now,
    updated_at: now
  };
  // 仅合并允许的补充字段（防止误传入越界字段）
  const allowedExtra = ['color', 'style', 'material', 'pattern', 'season', 'occasion', 'ai_tags', 'features', 'category'];
  for (const k of Object.keys(options)) {
    if (allowedExtra.includes(k)) doc[k] = options[k];
  }
  return doc;
}

// 从 garments 集合映射到 profile（仅映射允许的关联/初始化字段）
function mapFromGarment(garment, options = {}) {
  return {
    garment_id: garment && garment._id,
    user_id: garment && garment.user_id,
    category: (garment && garment.category) || '',
    source: PROFILE_SOURCE.MANUAL,
    status: ASSET_STATUS.READY,
    color: [],
    style: '',
    material: '',
    pattern: '',
    season: [],
    occasion: [],
    ai_tags: [],
    features: {},
    created_at: Date.now(),
    updated_at: Date.now()
  };
}

module.exports = {
  GARMENT_CATEGORY,
  PATTERN_TYPE,
  STYLE_TYPE,
  MATERIAL_TYPE,
  SEASON_TYPE,
  OCCASION_TYPE,
  COLOR_TYPE,
  PROFILE_SOURCE,
  ASSET_STATUS,
  GARMENT_PROFILE_SCHEMA,
  validateGarmentProfile,
  createDefaultDoc,
  mapFromGarment
};

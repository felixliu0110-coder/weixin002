/**
 * Garment Asset 类型定义
 * 
 * 定义衣物数字资产的数据结构和常量
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

// 资产状态
const ASSET_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  READY: 'ready',
  FAILED: 'failed'
};

// 衣物数字档案 schema
const GARMENT_PROFILE_SCHEMA = {
  // 关联信息
  garment_id: { type: 'string', required: true, description: '关联的 garments 集合 ID' },
  user_id: { type: 'string', required: true, description: '用户 OPENID' },
  
  // 基础信息
  category: { type: 'string', enum: Object.values(GARMENT_CATEGORY), description: '衣物类别' },
  name: { type: 'string', description: '衣物名称' },
  
  // 视觉特征
  color: { type: 'array', items: { type: 'string' }, description: '主色调列表' },
  dominant_color: { type: 'string', description: '主色调' },
  pattern: { type: 'string', enum: Object.values(PATTERN_TYPE), description: '图案类型' },
  style: { type: 'string', enum: Object.values(STYLE_TYPE), description: '风格类型' },
  material: { type: 'string', enum: Object.values(MATERIAL_TYPE), description: '材质类型' },
  
  // 使用场景
  season: { type: 'array', items: { type: 'string' }, description: '适用季节' },
  occasion: { type: 'array', items: { type: 'string' }, description: '适用场合' },
  
  // AI 分析结果（预留）
  ai_tags: { type: 'array', items: { type: 'string' }, description: 'AI 标签' },
  features: {
    silhouette: { type: 'string', description: '廓形' },
    fit: { type: 'string', description: '版型' },
    length: { type: 'string', description: '衣长' },
    sleeve: { type: 'string', description: '袖长' },
    neckline: { type: 'string', description: '领型' }
  },
  
  // 数值特征（预留）
  visual_embedding: { type: 'string', description: '视觉特征向量（未来用于相似推荐）' },
  
  // 状态
  status: { type: 'string', enum: Object.values(ASSET_STATUS) },
  error_code: { type: 'string', description: '失败原因码' },
  error_message: { type: 'string', description: '失败原因描述' },
  
  // 时间戳
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
  
  return {
    valid: errors.length === 0,
    errors
  };
}

// 创建默认文档
function createDefaultDoc(garmentId, openid, options = {}) {
  const now = Date.now();
  return {
    garment_id: garmentId,
    user_id: openid,
    category: options.category || '',
    name: options.name || '',
    status: ASSET_STATUS.PENDING,
    created_at: now,
    updated_at: now,
    ...options
  };
}

// 从 garments 集合映射到 profile
function mapFromGarment(garment, options = {}) {
  return {
    garment_id: garment._id,
    user_id: garment.user_id,
    category: garment.category || '',
    name: garment.name || '',
    size_label: garment.size_label || '',
    measurements: garment.measurements || null,
    status: ASSET_STATUS.PENDING,
    created_at: Date.now(),
    updated_at: Date.now(),
    ...options
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
  ASSET_STATUS,
  GARMENT_PROFILE_SCHEMA,
  validateGarmentProfile,
  createDefaultDoc,
  mapFromGarment
};

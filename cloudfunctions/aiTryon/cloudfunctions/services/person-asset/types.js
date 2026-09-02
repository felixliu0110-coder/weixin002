/**
 * Person Asset 类型定义
 * 
 * 定义人物资产的数据结构和常量
 */

// 人物来源类型
const PERSON_SOURCE = {
  UPLOAD: 'upload',        // 用户上传
  GENERATED: 'generated'   // AI 生成
};

// 资产状态
const ASSET_STATUS = {
  PROCESSING: 'processing',
  READY: 'ready',
  FAILED: 'failed'
};

// 图片类型
const IMAGE_TYPE = {
  ORIGINAL: 'original',      // 用户上传原图
  ANCHOR: 'anchor',          // AI 生成的锚定图
  THREE_VIEW: 'three_view',  // 三视图合成图
  ANALYSIS: 'analysis'       // 分析结果图
};

// 人物资产文档结构
const PERSON_ASSET_SCHEMA = {
  user_id: { type: 'string', required: true, description: '用户 OPENID' },
  openid: { type: 'string', required: true, description: '微信 OPENID（兼容字段）' },
  avatar_profile_id: { type: 'string', description: '关联的人物档案 ID' },
  
  // 图片资产
  original_photo: { type: 'string', description: '用户上传的原始全身照 cloud://fileID' },
  front_photo: { type: 'string', description: '正面照 cloud://fileID' },
  anchor_image: { type: 'string', description: 'AI 生成的锚定图 cloud://fileID' },
  three_view_composite: { type: 'string', description: '三视图合成图 cloud://fileID（实验性）' },
  
  // 来源信息
  source: { type: 'string', enum: ['upload', 'generated'], description: '来源类型' },
  provider: { type: 'string', description: '使用的 Provider（agnes/aitryon/...）' },
  
  // 人物分析结果（暂不使用 AI，预留结构）
  body_analysis: {
    height_cm: { type: 'number', description: '身高（cm）' },
    weight_kg: { type: 'number', description: '体重（kg）' },
    skin_tone: { type: 'string', enum: ['light', 'natural', 'tan', 'deep'] },
    body_type: { type: 'string', description: '体型描述' },
    confidence: { type: 'number', description: '分析置信度 0-1' }
  },
  
  // 状态
  status: { type: 'string', enum: ['processing', 'ready', 'failed'] },
  error_code: { type: 'string', description: '失败原因码' },
  error_message: { type: 'string', description: '失败原因描述' },
  
  // 时间戳
  created_at: { type: 'number', description: '创建时间' },
  updated_at: { type: 'number', description: '更新时间' }
};

// 验证函数
function validatePersonAsset(data) {
  const errors = [];
  
  if (!data.user_id || typeof data.user_id !== 'string') {
    errors.push('user_id is required and must be string');
  }
  
  if (data.original_photo && !data.original_photo.startsWith('cloud://')) {
    errors.push('original_photo must be a cloud:// fileID');
  }
  
  if (data.anchor_image && !data.anchor_image.startsWith('cloud://')) {
    errors.push('anchor_image must be a cloud:// fileID');
  }
  
  if (data.three_view_composite && !data.three_view_composite.startsWith('cloud://')) {
    errors.push('three_view_composite must be a cloud:// fileID');
  }
  
  if (data.source && !Object.values(PERSON_SOURCE).includes(data.source)) {
    errors.push('source must be one of: ' + Object.values(PERSON_SOURCE).join(','));
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
function createDefaultDoc(openid, options = {}) {
  const now = Date.now();
  return {
    user_id: openid,
    openid,
    source: PERSON_SOURCE.UPLOAD,
    status: ASSET_STATUS.PROCESSING,
    created_at: now,
    updated_at: now,
    ...options
  };
}

module.exports = {
  PERSON_SOURCE,
  ASSET_STATUS,
  IMAGE_TYPE,
  PERSON_ASSET_SCHEMA,
  validatePersonAsset,
  createDefaultDoc
};

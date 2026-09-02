/**
 * Person Asset 服务入口
 * 
 * 统一管理人物资产的生命周期
 * 
 * 能力：
 * - createPersonAsset(): 创建人物资产
 * - getPersonAsset(): 获取人物资产
 * - updatePersonAnalysis(): 更新人物分析
 * - setAnchorImage(): 设置锚定图
 */

const PersonAssetRepository = require('./repository');
const PersonAssetAnalyzer = require('./analyzer');
const { PERSON_SOURCE, ASSET_STATUS, validatePersonAsset, createDefaultDoc } = require('./types');

class PersonAssetService {
  constructor(db) {
    this.db = db;
    this.repository = new PersonAssetRepository(db);
    this.analyzer = new PersonAssetAnalyzer();
  }

  /**
   * 创建人物资产
   * 
   * @param {Object} params
   * @param {string} params.openid - 用户 OPENID
   * @param {string} params.avatarProfileId - 关联的人物档案 ID
   * @param {string} params.originalPhoto - 用户上传的原始照片 fileID
   * @returns {Promise<Object>}
   */
  async createPersonAsset(params) {
    const { openid, avatarProfileId, originalPhoto } = params;
    
    // 构建文档
    const doc = createDefaultDoc(openid, {
      avatar_profile_id: avatarProfileId,
      source: PERSON_SOURCE.UPLOAD,
      original_photo: originalPhoto
    });
    
    // 校验
    const validation = validatePersonAsset(doc);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }
    
    // 创建
    const asset = await this.repository.create(doc);
    
    // 生成报告
    const report = this.analyzer.generateReport(asset);
    
    return {
      ok: true,
      assetId: asset._id,
      ...asset,
      report
    };
  }

  /**
   * 获取人物资产
   * 
   * @param {string} assetId - 资产 ID
   * @param {string} openid - 用户 OPENID
   * @returns {Promise<Object|null>}
   */
  async getPersonAsset(assetId, openid) {
    const asset = await this.repository.findById(assetId, openid);
    
    if (!asset) {
      // 兼容：尝试从 avatar_views 迁移
      const compatible = await this.repository.getCompatible(openid);
      if (compatible) {
        return {
          ...compatible,
          migrated: true,
          migrationNote: '从 avatar_views 兼容读取'
        };
      }
      return null;
    }
    
    return asset;
  }

  /**
   * 获取当前用户的最新人物资产
   * 
   * @param {string} openid - 用户 OPENID
   * @returns {Promise<Object|null>}
   */
  async getCurrentPersonAsset(openid) {
    return this.repository.getCompatible(openid);
  }

  /**
   * 更新人物分析
   * 
   * @param {string} assetId - 资产 ID
   * @param {string} openid - 用户 OPENID
   * @param {Object} analysis - 分析结果
   * @returns {Promise<Object>}
   */
  async updatePersonAnalysis(assetId, openid, analysis) {
    const updates = {
      body_analysis: analysis,
      updated_at: Date.now()
    };
    
    return this.repository.update(assetId, openid, updates);
  }

  /**
   * 设置锚定图
   * 
   * @param {string} assetId - 资产 ID
   * @param {string} openid - 用户 OPENID
   * @param {string} fileID - 云存储 fileID
   * @param {string} provider - Provider 名称
   * @returns {Promise<Object>}
   */
  async setAnchorImage(assetId, openid, fileID, provider) {
    return this.repository.setAnchorImage(assetId, openid, fileID, provider);
  }

  /**
   * 设置原始照片
   * 
   * @param {string} assetId - 资产 ID
   * @param {string} openid - 用户 OPENID
   * @param {string} fileID - 云存储 fileID
   * @returns {Promise<Object>}
   */
  async setOriginalPhoto(assetId, openid, fileID) {
    return this.repository.setOriginalPhoto(assetId, openid, fileID);
  }

  /**
   * 删除人物资产
   * 
   * @param {string} assetId - 资产 ID
   * @param {string} openid - 用户 OPENID
   * @returns {Promise<boolean>}
   */
  async deletePersonAsset(assetId, openid) {
    return this.repository.delete(assetId, openid);
  }

  /**
   * 列出用户的人物资产
   * 
   * @param {string} openid - 用户 OPENID
   * @param {number} limit - 限制数量
   * @returns {Promise<Array>}
   */
  async listPersonAssets(openid, limit = 10) {
    return this.repository.listByUserId(openid, limit);
  }

  /**
   * 获取人物资产状态
   * 
   * @param {string} openid - 用户 OPENID
   * @returns {Promise<Object>}
   */
  async getPersonAssetStatus(openid) {
    const asset = await this.getCurrentPersonAsset(openid);
    
    if (!asset) {
      return {
        hasAsset: false,
        status: 'none'
      };
    }
    
    return {
      hasAsset: true,
      assetId: asset._id,
      status: asset.status,
      hasOriginalPhoto: !!asset.original_photo,
      hasAnchorImage: !!asset.anchor_image,
      hasThreeViewComposite: !!asset.three_view_composite,
      provider: asset.provider,
      createdAt: asset.created_at
    };
  }

  /**
   * 预处理检查
   * 
   * @param {string} assetId - 资产 ID
   * @param {string} openid - 用户 OPENID
   * @returns {Promise<Object>}
   */
  async preflightCheck(assetId, openid) {
    const asset = await this.getPersonAsset(assetId, openid);
    
    if (!asset) {
      return {
        valid: false,
        warnings: ['人物资产不存在']
      };
    }
    
    return this.analyzer.preflightCheck(asset);
  }
}

// 单例
let serviceInstance = null;

function getPersonAssetService(db) {
  if (!serviceInstance) {
    serviceInstance = new PersonAssetService(db);
  }
  return serviceInstance;
}

module.exports = {
  PersonAssetService,
  getPersonAssetService
};

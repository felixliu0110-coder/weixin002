/**
 * Garment Asset 服务入口
 * 
 * 统一管理衣物数字资产的生命周期
 * 
 * 能力：
 * - createGarmentProfile(): 创建衣物数字档案
 * - getGarmentProfile(): 获取衣物数字档案
 * - updateGarmentProfile(): 更新衣物数字档案
 * - deleteGarmentProfile(): 删除衣物数字档案
 * - listGarmentProfiles(): 列出衣物数字档案
 * - preflightCheck(): 预处理检查
 */

const GarmentAssetRepository = require('./repository');
const GarmentAssetAnalyzer = require('./analyzer');
const { ASSET_STATUS, validateGarmentProfile, createDefaultDoc, mapFromGarment } = require('./types');

class GarmentAssetService {
  constructor(db) {
    this.db = db;
    this.repository = new GarmentAssetRepository(db);
    this.analyzer = new GarmentAssetAnalyzer();
  }

  /**
   * 创建衣物数字档案
   * 
   * @param {Object} params
   * @param {string} params.garmentId - 关联的 garments 集合 ID
   * @param {string} params.openid - 用户 OPENID
   * @param {Object} params.metadata - 额外元数据
   * @returns {Promise<Object>}
   */
  async createGarmentProfile(params) {
    const { garmentId, openid, metadata = {} } = params;
    
    // 构建文档
    const doc = createDefaultDoc(garmentId, openid, {
      ...metadata,
      status: ASSET_STATUS.PROCESSING
    });
    
    // 校验
    const validation = validateGarmentProfile(doc);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }
    
    // 创建
    const profile = await this.repository.create(doc);
    
    // 生成报告
    const report = this.analyzer.generateReport(profile);
    
    return {
      ok: true,
      profileId: profile._id,
      ...profile,
      report
    };
  }

  /**
   * 从 garments 集合导入创建档案
   */
  async importFromGarment(garment, openid) {
    const doc = mapFromGarment(garment, { user_id: openid });
    const validation = validateGarmentProfile(doc);
    
    if (!validation.valid) {
      throw new Error(`Import validation failed: ${validation.errors.join(', ')}`);
    }
    
    return this.repository.create(doc);
  }

  /**
   * 获取衣物数字档案
   * 
   * @param {string} profileId - 档案 ID
   * @param {string} openid - 用户 OPENID
   * @returns {Promise<Object|null>}
   */
  async getGarmentProfile(profileId, openid) {
    return this.repository.findById(profileId, openid);
  }

  /**
   * 根据 garment_id 获取档案
   * 
   * @param {string} garmentId - 衣物 ID
   * @param {string} openid - 用户 OPENID
   * @returns {Promise<Object|null>}
   */
  async getProfileByGarmentId(garmentId, openid) {
    return this.repository.findByGarmentId(garmentId, openid);
  }

  /**
   * 更新衣物数字档案
   * 
   * @param {string} profileId - 档案 ID
   * @param {string} openid - 用户 OPENID
   * @param {Object} updates - 更新内容
   * @returns {Promise<Object>}
   */
  async updateGarmentProfile(profileId, openid, updates) {
    return this.repository.update(profileId, openid, updates);
  }

  /**
   * 更新状态
   * 
   * @param {string} profileId - 档案 ID
   * @param {string} openid - 用户 OPENID
   * @param {string} status - 新状态
   * @param {Object} metadata - 附加元数据
   * @returns {Promise<Object>}
   */
  async updateStatus(profileId, openid, status, metadata = {}) {
    return this.repository.updateStatus(profileId, openid, status, metadata);
  }

  /**
   * 删除衣物数字档案
   * 
   * @param {string} profileId - 档案 ID
   * @param {string} openid - 用户 OPENID
   * @returns {Promise<boolean>}
   */
  async deleteGarmentProfile(profileId, openid) {
    return this.repository.delete(profileId, openid);
  }

  /**
   * 列出用户的衣物数字档案
   * 
   * @param {string} openid - 用户 OPENID
   * @param {number} limit - 限制数量
   * @returns {Promise<Array>}
   */
  async listGarmentProfiles(openid, limit = 50) {
    return this.repository.listByUserId(openid, limit);
  }

  /**
   * 按类别筛选
   * 
   * @param {string} openid - 用户 OPENID
   * @param {string} category - 衣物类别
   * @param {number} limit - 限制数量
   * @returns {Promise<Array>}
   */
  async listByCategory(openid, category, limit = 50) {
    return this.repository.listByCategory(openid, category, limit);
  }

  /**
   * 统计衣物数量
   * 
   * @param {string} openid - 用户 OPENID
   * @returns {Promise<number>}
   */
  async countGarmentProfiles(openid) {
    return this.repository.countByUserId(openid);
  }

  /**
   * 批量导入
   * 
   * @param {Array} profiles - 档案列表
   * @returns {Promise<Array>}
   */
  async batchCreate(profiles) {
    return this.repository.batchCreate(profiles);
  }

  /**
   * 预处理检查
   * 
   * @param {string} profileId - 档案 ID
   * @param {string} openid - 用户 OPENID
   * @returns {Promise<Object>}
   */
  async preflightCheck(profileId, openid) {
    const profile = await this.getGarmentProfile(profileId, openid);
    
    if (!profile) {
      return {
        valid: false,
        warnings: ['衣物数字档案不存在']
      };
    }
    
    return this.analyzer.preflightCheck(profile);
  }

  /**
   * 计算相似度
   * 
   * @param {Object} profile1 - 档案1
   * @param {Object} profile2 - 档案2
   * @returns {Object}
   */
  calculateSimilarity(profile1, profile2) {
    return this.analyzer.calculateSimilarity(profile1, profile2);
  }

  /**
   * 获取衣物档案状态
   * 
   * @param {string} openid - 用户 OPENID
   * @returns {Promise<Object>}
   */
  async getGarmentAssetStatus(openid) {
    const count = await this.countGarmentProfiles(openid);
    const profiles = await this.listByUserId(openid, 10);
    
    const byCategory = {};
    for (const p of profiles) {
      if (!byCategory[p.category]) {
        byCategory[p.category] = 0;
      }
      byCategory[p.category]++;
    }
    
    return {
      totalCount: count,
      recentProfiles: profiles.map(p => ({
        id: p._id,
        garmentId: p.garment_id,
        category: p.category,
        name: p.name,
        status: p.status
      })),
      byCategory
    };
  }
}

// 单例
let serviceInstance = null;

function getGarmentAssetService(db) {
  if (!serviceInstance) {
    serviceInstance = new GarmentAssetService(db);
  }
  return serviceInstance;
}

module.exports = {
  GarmentAssetService,
  getGarmentAssetService
};

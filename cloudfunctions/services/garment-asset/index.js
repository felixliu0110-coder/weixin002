/**
 * Garment Asset 服务入口
 *
 * 统一管理衣物数字资产（garment_profiles）的生命周期。
 *
 * 公开 API（仅下列）：
 *   createGarmentProfile / getGarmentProfile / getGarmentProfileByGarmentId
 *   updateGarmentProfile / deleteGarmentProfile / listGarmentProfiles
 *   getOrCreateGarmentProfile / preflightCheck
 *
 * 不在此阶段承担：推荐 / 相似度 / 批量迁移 / AI 分析 / 统计业务。
 */

const GarmentAssetRepository = require('./repository');
const GarmentAssetAnalyzer = require('./analyzer');
const { ASSET_STATUS, validateGarmentProfile, createDefaultDoc } = require('./types');

class GarmentAssetService {
  constructor(db) {
    this.db = db;
    this.repository = new GarmentAssetRepository(db);
    this.analyzer = new GarmentAssetAnalyzer();
  }

  async createGarmentProfile(params) {
    const { garmentId, openid, metadata = {} } = params || {};
    if (!garmentId) throw new Error('garmentId is required');
    if (!openid) throw new Error('openid is required');
    const doc = createDefaultDoc(garmentId, openid, metadata);
    const validation = validateGarmentProfile(doc);
    if (!validation.valid) throw new Error('Validation failed: ' + validation.errors.join(', '));
    const profile = await this.repository.create(doc);
    return { ok: true, profileId: profile._id, profile, report: this.analyzer.generateReport(profile) };
  }

  async getGarmentProfile(profileId, openid) {
    return this.repository.findById(profileId, openid);
  }

  async getGarmentProfileByGarmentId(garmentId, openid) {
    return this.repository.findByGarmentId(garmentId, openid);
  }

  async updateGarmentProfile(profileId, openid, updates) {
    return this.repository.update(profileId, openid, updates || {});
  }

  async deleteGarmentProfile(profileId, openid) {
    return this.repository.delete(profileId, openid);
  }

  async listGarmentProfiles(openid, limit = 50) {
    return this.repository.listByUserId(openid, limit);
  }

  /**
   * 真实 getOrCreate 流程：
   *   garmentId -> 读取 garments -> 不存在 NOT_FOUND
   *   -> ownership 校验 -> builtin FORBIDDEN -> 非 ready INVALID_ARGUMENT
   *   -> 查询 garment_profiles -> 存在返回；不存在新建
   *   -> category 从 garments.category 初始化，source=manual，status=ready
   */
  async getOrCreateGarmentProfile(garmentId, openid) {
    if (!garmentId) throw new Error('garmentId is required');
    if (!openid) throw new Error('openid is required');
    const profile = await this.repository.getOrCreateByGarmentId(garmentId, openid);
    return { ok: true, profileId: profile._id, profile, report: this.analyzer.generateReport(profile) };
  }

  async preflightCheck(profileId, openid) {
    const profile = await this.getGarmentProfile(profileId, openid);
    return this.analyzer.preflightCheck(profile);
  }
}

let serviceInstance = null;
function getGarmentAssetService(db) {
  if (!serviceInstance || serviceInstance.db !== db) {
    serviceInstance = new GarmentAssetService(db);
  }
  return serviceInstance;
}

module.exports = { GarmentAssetService, getGarmentAssetService };

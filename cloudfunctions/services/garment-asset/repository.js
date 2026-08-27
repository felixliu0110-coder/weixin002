/**
 * Garment Asset 数据库仓库
 *
 * 管理 garment_profiles 集合的 CRUD 操作。
 * 所有 profile 查询均带 user_id === 当前 openid 的归属限制，
 * 禁止仅凭 garment_id 读取其它用户数据。
 */

const { ASSET_STATUS, PROFILE_SOURCE } = require('./types');

class GarmentAssetRepository {
  constructor(db) {
    this.db = db;
    this.collectionName = 'garment_profiles';
  }

  // 通过 garments._id 读取衣物实体（用于 getOrCreate 流程的归属校验）
  async _getGarment(garmentId, openid) {
    if (!this.db || !this.db.collection) return null;
    try {
      const res = await this.db.collection('garments').doc(garmentId).get();
      const g = res && res.data;
      if (!g) return { error: 'NOT_FOUND' };
      if (g.user_id !== openid) return { error: 'FORBIDDEN' };
      if (g.type === 'builtin') return { error: 'FORBIDDEN_BUILTIN' };
      if (g.status && g.status !== ASSET_STATUS.READY) return { error: 'INVALID_ARGUMENT' };
      return { garment: g };
    } catch (e) {
      return { error: 'NOT_FOUND', cause: e };
    }
  }

  async create(data) {
    const doc = { ...data, created_at: Date.now(), updated_at: Date.now() };
    const res = await this.db.collection(this.collectionName).add({ data: doc });
    return { _id: res._id, ...doc };
  }

  async findById(id, openid) {
    const res = await this.db.collection(this.collectionName).doc(id).get();
    const d = res && res.data;
    if (d && d.user_id === openid) return d;
    return null;
  }

  async findByGarmentId(garmentId, openid) {
    const res = await this.db.collection(this.collectionName)
      .where({ garment_id: garmentId, user_id: openid })
      .limit(1).get();
    return (res && res.data && res.data[0]) || null;
  }

  async update(id, openid, updates) {
    const existing = await this.findById(id, openid);
    if (!existing) throw new Error('GARMENT_PROFILE_NOT_FOUND');
    await this.db.collection(this.collectionName).doc(id).update({
      data: { ...updates, updated_at: Date.now() }
    });
    return { ...existing, ...updates, updated_at: Date.now() };
  }

  async delete(id, openid) {
    const existing = await this.findById(id, openid);
    if (!existing) throw new Error('GARMENT_PROFILE_NOT_FOUND');
    await this.db.collection(this.collectionName).doc(id).remove();
    return true;
  }

  async listByUserId(openid, limit = 50) {
    const res = await this.db.collection(this.collectionName)
      .where({ user_id: openid })
      .orderBy('updated_at', 'desc').limit(limit).get();
    return (res && res.data) || [];
  }

  // getOrCreate：以 garments 为权威来源，按 garments.category 初始化
  async getOrCreateByGarmentId(garmentId, openid) {
    const got = await this._getGarment(garmentId, openid);
    if (got.error === 'NOT_FOUND') throw new Error('GARMENT_NOT_FOUND');
    if (got.error === 'FORBIDDEN' || got.error === 'FORBIDDEN_BUILTIN') throw new Error('FORBIDDEN');
    if (got.error === 'INVALID_ARGUMENT') throw new Error('GARMENT_INVALID_ARGUMENT');
    const garment = got.garment;

    const existing = await this.findByGarmentId(garmentId, openid);
    if (existing) return existing;

    const doc = {
      garment_id: garment._id,
      user_id: openid,
      category: garment.category || '',
      source: PROFILE_SOURCE.MANUAL,
      status: ASSET_STATUS.READY,
      color: [], style: '', material: '', pattern: '',
      season: [], occasion: [], ai_tags: [], features: {},
      created_at: Date.now(), updated_at: Date.now()
    };
    const res = await this.db.collection(this.collectionName).add({ data: doc });
    return { _id: res._id, ...doc };
  }
}

module.exports = GarmentAssetRepository;

/**
 * Garment Asset 数据库仓库
 * 
 * 管理 garment_profiles 集合的 CRUD 操作
 * 兼容已有 garments 集合
 */

const { ASSET_STATUS } = require('./types');

class GarmentAssetRepository {
  constructor(db) {
    this.db = db;
    this.collectionName = 'garment_profiles';
  }

  /**
   * 创建衣物数字档案
   */
  async create(data) {
    const doc = {
      ...data,
      created_at: Date.now(),
      updated_at: Date.now()
    };
    
    const res = await this.db.collection(this.collectionName).add({ data: doc });
    return { _id: res._id, ...doc };
  }

  /**
   * 根据 ID 查询
   */
  async findById(id, openid) {
    const res = await this.db.collection(this.collectionName)
      .doc(id)
      .get();
    
    if (res.data && res.data.user_id === openid) {
      return res.data;
    }
    return null;
  }

  /**
   * 根据 garment_id 查询
   */
  async findByGarmentId(garmentId, openid) {
    const res = await this.db.collection(this.collectionName)
      .where({ garment_id: garmentId, user_id: openid })
      .limit(1)
      .get();
    
    return res.data && res.data[0] || null;
  }

  /**
   * 更新档案
   */
  async update(id, openid, updates) {
    const existing = await this.findById(id, openid);
    if (!existing) {
      throw new Error('GARMENT_PROFILE_NOT_FOUND');
    }
    
    await this.db.collection(this.collectionName)
      .doc(id)
      .update({
        data: {
          ...updates,
          updated_at: Date.now()
        }
      });
    
    return { ...existing, ...updates, updated_at: Date.now() };
  }

  /**
   * 删除档案
   */
  async delete(id, openid) {
    const existing = await this.findById(id, openid);
    if (!existing) {
      throw new Error('GARMENT_PROFILE_NOT_FOUND');
    }
    
    await this.db.collection(this.collectionName).doc(id).remove();
    return true;
  }

  /**
   * 批量更新状态
   */
  async updateStatus(id, openid, status, metadata = {}) {
    return this.update(id, openid, {
      status,
      updated_at: Date.now(),
      ...metadata
    });
  }

  /**
   * 列出用户的所有衣物档案
   */
  async listByUserId(openid, limit = 50) {
    const res = await this.db.collection(this.collectionName)
      .where({ user_id: openid })
      .orderBy('updated_at', 'desc')
      .limit(limit)
      .get();
    
    return res.data || [];
  }

  /**
   * 按类别筛选
   */
  async listByCategory(openid, category, limit = 50) {
    const res = await this.db.collection(this.collectionName)
      .where({ user_id: openid, category })
      .orderBy('updated_at', 'desc')
      .limit(limit)
      .get();
    
    return res.data || [];
  }

  /**
   * 批量创建（从 garments 集合导入）
   */
  async batchCreate(profiles) {
    const results = [];
    for (const profile of profiles) {
      try {
        const doc = {
          ...profile,
          created_at: Date.now(),
          updated_at: Date.now()
        };
        const res = await this.db.collection(this.collectionName).add({ data: doc });
        results.push({ _id: res._id, ...doc });
      } catch (e) {
        results.push({ error: e.message, ...profile });
      }
    }
    return results;
  }

  /**
   * 统计用户衣物数量
   */
  async countByUserId(openid) {
    const res = await this.db.collection(this.collectionName)
      .where({ user_id: openid })
      .count();
    return res.total || 0;
  }

  /**
   * 兼容查询：如果没有 profile，从 garments 返回基础信息
   */
  async getCompatible(garmentId, openid) {
    // 优先查询 garment_profiles
    const res = await this.db.collection(this.collectionName)
      .where({ garment_id: garmentId, user_id: openid })
      .limit(1)
      .get();
    
    if (res.data && res.data[0]) {
      return res.data[0];
    }
    
    // 回退：返回基础 garments 数据
    return null;
  }
}

module.exports = GarmentAssetRepository;

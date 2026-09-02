/**
 * Person Asset 数据库仓库
 * 
 * 管理 person_assets 集合的 CRUD 操作
 * 兼容现有 avatar_views 集合
 */

const { ASSET_STATUS } = require('./types');

class PersonAssetRepository {
  constructor(db) {
    this.db = db;
    this.collectionName = 'person_assets';
  }

  /**
   * 创建人物资产
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
   * 根据用户 ID 查询最新资产
   */
  async findByUserId(openid) {
    const res = await this.db.collection(this.collectionName)
      .where({ user_id: openid })
      .orderBy('created_at', 'desc')
      .limit(1)
      .get();
    
    return res.data && res.data[0] || null;
  }

  /**
   * 按 avatar_profile_id + user_id(openid) 精确匹配 Person Asset。
   * Phase 4.2.1：用于把 avatar_views.avatar_profile_id 精确关联到对应 Person Asset，
   * 严禁返回“当前用户最新 Person Asset”作为顶替，严禁跨用户查询。
   * 若同一 profile 对应多个 asset，优先选取 updated_at 最新且具备可用人物照片者。
   * 未找到匹配 → 返回 null（上层应走 PERSON_ASSET_REQUIRED，不得猜测）。
   */
  async findByAvatarProfileId(avatarProfileId, openid) {
    if (!avatarProfileId || !openid) return null;
    const res = await this.db.collection(this.collectionName)
      .where({ avatar_profile_id: avatarProfileId, user_id: openid })
      .orderBy('updated_at', 'desc')
      .get();
    const list = (res && res.data) || [];
    if (!list.length) return null;
    // 优先取具备可用人物照片的资产；否则退化为排序第一（仍属同一 profile + user）
    const usable = list.find((a) =>
      a && (a.original_photo || a.originalPhoto || a.front_photo || a.frontPhoto || a.anchor_image || a.anchorImage));
    return usable || list[0] || null;
  }

  /**
   * 更新资产
   */
  async update(id, openid, updates) {
    // 先验证 ownership
    const existing = await this.findById(id, openid);
    if (!existing) {
      throw new Error('PERSON_ASSET_NOT_FOUND');
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
   * 删除资产
   */
  async delete(id, openid) {
    const existing = await this.findById(id, openid);
    if (!existing) {
      throw new Error('PERSON_ASSET_NOT_FOUND');
    }
    
    await this.db.collection(this.collectionName).doc(id).remove();
    return true;
  }

  /**
   * 更新状态
   */
  async updateStatus(id, openid, status, metadata = {}) {
    return this.update(id, openid, {
      status,
      updated_at: Date.now(),
      ...metadata
    });
  }

  /**
   * 设置锚定图
   */
  async setAnchorImage(id, openid, fileID, provider) {
    return this.update(id, openid, {
      anchor_image: fileID,
      provider,
      status: ASSET_STATUS.READY,
      updated_at: Date.now()
    });
  }

  /**
   * 设置原始照片
   */
  async setOriginalPhoto(id, openid, fileID) {
    return this.update(id, openid, {
      original_photo: fileID,
      status: ASSET_STATUS.READY,
      updated_at: Date.now()
    });
  }

  /**
   * 批量查询用户资产列表
   */
  async listByUserId(openid, limit = 10) {
    const res = await this.db.collection(this.collectionName)
      .where({ user_id: openid })
      .orderBy('created_at', 'desc')
      .limit(limit)
      .get();
    
    return res.data || [];
  }

  /**
   * 兼容旧 avatar_views 查询
   * 如果 person_assets 不存在，回退到 avatar_views
   */
  async getCompatible(openid) {
    // 优先查询 person_assets
    const res = await this.db.collection(this.collectionName)
      .where({ user_id: openid })
      .orderBy('created_at', 'desc')
      .limit(1)
      .get();
    
    if (res.data && res.data[0]) {
      return res.data[0];
    }
    
    // 回退到 avatar_views
    const avRes = await this.db.collection('avatar_views')
      .where({ user_id: openid })
      .orderBy('created_at', 'desc')
      .limit(1)
      .get();
    
    if (avRes.data && avRes.data[0]) {
      return {
        _id: avRes.data[0]._id,
        user_id: openid,
        source: 'generated',
        status: avRes.data[0].status || 'ready',
        three_view_composite: avRes.data[0].views?.composite,
        provider: avRes.data[0].provider,
        created_at: avRes.data[0].created_at || avRes.data[0].createdAt,
        updated_at: avRes.data[0].updated_at || avRes.data[0].updatedAt
      };
    }
    
    return null;
  }
}

module.exports = PersonAssetRepository;

/* 数据迁移工具（dry-run 只读统计，不在普通请求中写旧字段）：
   统一字段约定：user_id / created_at / updated_at；旧数据兼容 user_id||_openid、created_at||createdAt、updated_at||updatedAt。
   本模块只做统计与校验，不做任何自动改写。 */

const MIGRATION_COLLECTIONS = [
  "avatar_profiles",
  "avatar_views",
  "garments",
  "garment_views",
  "tryon_tasks",
  "tryon_results",
  "favorites",
  "quotas",
  "deletion_jobs"
];

async function collectMigrationStats(db) {
  const stats = {};
  for (const name of MIGRATION_COLLECTIONS) {
    let total = 0;
    let noUserId = 0;
    let noCreatedAt = 0;
    let noUpdatedAt = 0;
    let oldCreatedAt = 0;
    let oldUpdatedAt = 0;
    try {
      const res = await db.collection(name).limit(1000).get();
      for (const d of res.data || []) {
        total++;
        if (!(d.user_id || d._openid)) noUserId++;
        if (!(d.created_at || d.createdAt)) noCreatedAt++;
        if (!(d.updated_at || d.updatedAt)) noUpdatedAt++;
        if (d.createdAt && !d.created_at) oldCreatedAt++;
        if (d.updatedAt && !d.updated_at) oldUpdatedAt++;
      }
    } catch (e) {
      // 集合不存在：跳过
      continue;
    }
    stats[name] = { total, noUserId, noCreatedAt, noUpdatedAt, oldCreatedAt, oldUpdatedAt };
  }
  return stats;
}

module.exports = { MIGRATION_COLLECTIONS, collectMigrationStats };

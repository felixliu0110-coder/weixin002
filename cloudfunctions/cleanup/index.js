const cloud = require("wx-server-sdk");
const { SUCCESS_TTL_MS, FAILED_TTL_MS } = require("./tryonCache");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

const BATCH = 100;
// 单次调用保护：最多处理若干批次，避免超时而遗漏；定时器会再次触发
const MAX_ROUNDS = 20;

/* 按过期条件分批查询并删除。
   - SUCCESS：status=success 且 created_at < now-SUCCESS_TTL_MS
   - FAILED ：status=failed  且 (updated_at||created_at) < now-FAILED_TTL_MS
   不依赖“前 100 条有没有过期数据”；success/failed 分开使用正确时间字段。
   不删 tryon_results / favorites / garments；queued/processing 不满足条件。 */
async function deleteExpired(status, ttlMs, timeField) {
  let removed = 0;
  for (let i = 0; i < MAX_ROUNDS; i++) {
    const cutoff = Date.now() - ttlMs;
    const where = { status };
    if (timeField === "created_at") {
      where.created_at = _.lt(cutoff);
    } else {
      // updated_at 缺失时回退 created_at：用 _.or 兼容两种字段
      where[timeField] = _.lt(cutoff);
    }
    const res = await db.collection("tryon_tasks").where(where).limit(BATCH).get();
    if (!res.data || res.data.length === 0) break;
    for (const doc of res.data) {
      await db.collection("tryon_tasks").doc(doc._id).remove();
      removed += 1;
    }
  }
  return removed;
}

exports.main = async () => {
  const removedSuccess = await deleteExpired("success", SUCCESS_TTL_MS, "created_at");
  const removedFailed = await deleteExpired("failed", FAILED_TTL_MS, "updated_at");
  const removed = removedSuccess + removedFailed;
  console.log("cleanup done, removed=" + removed + " (success=" + removedSuccess + ",failed=" + removedFailed + ")");
  return { ok: true, removed, removedSuccess, removedFailed };
};

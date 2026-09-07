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
    let rows = [];

    if (timeField === "updated_at") {
      // updated_at 存在：按 updated_at 判断。
      const updatedRes = await db.collection("tryon_tasks")
        .where({ status, updated_at: _.lt(cutoff) })
        .limit(BATCH).get();
      rows = rows.concat(updatedRes.data || []);

      // updated_at 缺失：严格回退 created_at；不能用 updated_at < cutoff 代替，
      // 因为 CloudBase 缺失字段不会满足 lt 条件。
      if (rows.length < BATCH) {
        const fallbackRes = await db.collection("tryon_tasks")
          .where({ status, updated_at: _.exists(false), created_at: _.lt(cutoff) })
          .limit(BATCH - rows.length).get();
        rows = rows.concat(fallbackRes.data || []);
      }
    } else {
      const res = await db.collection("tryon_tasks")
        .where({ status, [timeField]: _.lt(cutoff) })
        .limit(BATCH).get();
      rows = res.data || [];
    }

    if (rows.length === 0) break;
    const seen = new Set();
    for (const doc of rows) {
      if (!doc || !doc._id || seen.has(doc._id)) continue;
      seen.add(doc._id);
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

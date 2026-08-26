const cloud = require("wx-server-sdk");
const { SUCCESS_TTL_MS, FAILED_TTL_MS } = require("./tryonCache");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

const BATCH = 100;
const MAX_ROUNDS = 200; // 防失控上限（每条件独立计数），正常由"无数据"自然终止

/* 按过期条件分批查询并删除，直到当前条件无符合记录。
   - SUCCESS：status=success 且 created_at < now-SUCCESS_TTL_MS
   - FAILED：status=failed 且 updated_at/created_at < now-FAILED_TTL_MS
   不依赖"前 100 条有没有过期数据"，故 100 条全为新数据但 101+ 为旧数据时仍能清理。
   不删 tryon_results / favorites / garments；queued/processing 不满足条件。 */
async function deleteByCondition(query, now, label) {
  let removed = 0;
  for (let i = 0; i < MAX_ROUNDS; i++) {
    const res = await query.limit(BATCH).get();
    if (!res.data || res.data.length === 0) break;
    for (const doc of res.data) {
      await db.collection("tryon_tasks").doc(doc._id).remove();
      removed += 1;
    }
  }
  console.log("cleanup " + label + " done, removed=" + removed);
  return removed;
}

exports.main = async () => {
  const now = Date.now();
  let removed = 0;

  // SUCCESS：以 created_at 判断过期（成功记录无 updated_at 依赖）
  removed += await deleteByCondition(
    db.collection("tryon_tasks").where({
      status: "success",
      created_at: _.lt(now - SUCCESS_TTL_MS)
    }),
    now, "success"
  );

  // FAILED：以 updated_at 优先、回退 created_at 判断过期
  removed += await deleteByCondition(
    db.collection("tryon_tasks").where({
      status: "failed",
      updated_at: _.lt(now - FAILED_TTL_MS)
    }),
    now, "failed-updated"
  );
  removed += await deleteByCondition(
    db.collection("tryon_tasks").where({
      status: "failed",
      updated_at: _.exists(false),
      created_at: _.lt(now - FAILED_TTL_MS)
    }),
    now, "failed-created"
  );

  console.log("cleanup done, removed=" + removed);
  return { ok: true, removed };
};

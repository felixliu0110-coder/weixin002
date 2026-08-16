const cloud = require("wx-server-sdk");
const { isCleanupCandidate } = require("./tryonCache");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async () => {
  const now = Date.now();
  let removed = 0;
  const coll = db.collection("tryon_tasks");
  // 分批扫描（云函数单次 get 上限 100），删除到无过期记录为止
  for (let i = 0; i < 20; i++) {
    const res = await coll.limit(100).get();
    if (!res.data || res.data.length === 0) break;
    const stale = res.data.filter((d) => isCleanupCandidate(d, now));
    if (stale.length === 0) break;
    for (const doc of stale) {
      await coll.doc(doc._id).remove();
      removed += 1;
    }
  }
  console.log("cleanup done, removed=" + removed);
  return { ok: true, removed };
};

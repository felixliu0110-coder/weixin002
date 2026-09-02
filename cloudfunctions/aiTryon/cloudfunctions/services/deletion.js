/* 账户数据删除作业（模型无关，可单测）：
   - deletion_jobs 状态机：requested -> processing -> completed / failed；
   - 幂等：同用户存在未完成作业时直接复用，不重复创建；
   - 清理范围：avatar_profiles/avatar_views/garments/garment_views/tryon_tasks/tryon_results/favorites/quotas
     及用户拥有的云存储文件（original_file_id / views.composite / tryon_image / face_photo_id / body_photo_id）。 */
const { appError } = require("./errors");

/* deletion_jobs 独立状态机：requested -> processing -> completed/failed */
const DELETION_TRANSITIONS = {
  requested: ["processing", "failed"],
  processing: ["completed", "failed"],
  completed: [],
  failed: []
};

function assertDeletionTransition(from, to) {
  const allowed = DELETION_TRANSITIONS[from];
  if (!allowed || !allowed.includes(to)) {
    throw appError("CONFLICT", "非法状态跳转：" + (from || "?") + " -> " + (to || "?"));
  }
}

const DELETABLE_COLLECTIONS = [
  "avatar_profiles",
  "avatar_views",
  "garments",
  "garment_views",
  "tryon_tasks",
  "tryon_results",
  "favorites",
  "quotas"
];

function collectFileIDs(doc) {
  const out = [];
  const push = (v) => { if (v && v.indexOf("cloud://") === 0) out.push(v); };
  if (doc.original_file_id) push(doc.original_file_id);
  if (doc.tryon_image) push(doc.tryon_image);
  if (doc.face_photo_id) push(doc.face_photo_id);
  if (doc.body_photo_id) push(doc.body_photo_id);
  if (doc.views && doc.views.composite) push(doc.views.composite);
  return out;
}

async function requestDeletion(db, openid) {
  if (!openid) throw appError("AUTH_REQUIRED");
  const existing = await db.collection("deletion_jobs")
    .where({ user_id: openid })
    .orderBy("created_at", "desc")
    .limit(5)
    .get();
  const active = (existing.data || []).find((d) => d.status === "requested" || d.status === "processing");
  if (active) return { ok: true, jobId: active._id, status: active.status, duplicate: true };
  const now = Date.now();
  const addRes = await db.collection("deletion_jobs").add({
    data: {
      _openid: openid,
      user_id: openid,
      status: "requested",
      created_at: now,
      updated_at: now
    }
  });
  return { ok: true, jobId: addRes._id, status: "requested" };
}

async function runDeletion(db, cloud, openid, jobId) {
  if (!openid) throw appError("AUTH_REQUIRED");
  const jobColl = db.collection("deletion_jobs");
  let job;
  try {
    const r = await jobColl.doc(jobId).get();
    job = r.data;
  } catch (e) {
    throw appError("NOT_FOUND");
  }
  if ((job.user_id || job._openid) !== openid) throw appError("FORBIDDEN");
  assertDeletionTransition(job.status, "processing");
  await jobColl.doc(jobId).update({ data: { status: "processing", updated_at: Date.now() } });
  try {
    const fileIDs = new Set();
    for (const collName of DELETABLE_COLLECTIONS) {
      const coll = db.collection(collName);
      for (let page = 0; page < 50; page++) {
        const res = await coll.where({ user_id: openid }).limit(100).get();
        if (!res.data || res.data.length === 0) break;
        for (const doc of res.data) {
          for (const f of collectFileIDs(doc)) fileIDs.add(f);
          try { await coll.doc(doc._id).remove(); } catch (e) { /* 继续清理其余 */ }
        }
      }
    }
    const list = Array.from(fileIDs);
    for (let i = 0; i < list.length; i += 50) {
      try { await cloud.deleteFile({ fileList: list.slice(i, i + 50) }); } catch (e) { /* 尽力删除 */ }
    }
    assertDeletionTransition("processing", "completed");
    await jobColl.doc(jobId).update({ data: { status: "completed", updated_at: Date.now(), completed_at: Date.now(), removed_files: list.length } });
    return { ok: true, jobId, status: "completed", removedFiles: list.length };
  } catch (e) {
    try {
      assertDeletionTransition("processing", "failed");
      await jobColl.doc(jobId).update({ data: { status: "failed", error: e.appCode || "INTERNAL", updated_at: Date.now() } });
    } catch (e2) { /* 状态已终态 */ }
    throw e;
  }
}

module.exports = { DELETABLE_COLLECTIONS, collectFileIDs, requestDeletion, runDeletion };

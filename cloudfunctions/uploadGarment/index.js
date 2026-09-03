const cloud = require("wx-server-sdk");
const { requireLogin, requireId, requireString, requireEnum, requireArray, parseSizeLabel, parseMeasurements } = require("../services/validation");
const { appError, fmtErr } = require("../services/errors");
const { detectImageContentType } = require("../services/storage");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const CATEGORIES = ["上衣", "裤子"];
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 与 storage.MAX_BYTES 一致

/* 内容安全检测（下载 → 大小校验 → 按文件真实内容识别 MIME → imgSecCheck）。
   不信任前端 MIME，也不信任 cloudPath 扩展名；无法识别真实图片类型则拒绝。 */
async function checkFile(fileID) {
  const dl = await cloud.downloadFile({ fileID });
  const buf = dl.fileContent || Buffer.alloc(0);
  if (buf.length > MAX_FILE_BYTES) throw appError("PAYLOAD_TOO_LARGE", "文件过大");
  const contentType = detectImageContentType(buf);
  if (!contentType) throw appError("INVALID_ARGUMENT", "不支持的图片类型");
  const res = await cloud.openapi.security.imgSecCheck({
    media: { contentType, value: buf }
  });
  const pass = !res || res.errCode === 0;
  return { pass, label: (res && res.result && res.result.label) || 0 };
}

/* 上传衣物落库：服务端保存 original_file_id，返回服务端生成的 garmentId */
async function createGarment(event, openid) {
  const fileID = requireId(event.fileID, "fileID");
  if (fileID.indexOf("cloud://") !== 0) throw appError("INVALID_ARGUMENT", "fileID 不合法");
  const name = requireString(event.name, "name", 20);
  const category = requireEnum(event.category, "category", CATEGORIES);
  const { pass, label } = await checkFile(fileID);
  if (!pass) {
    return { ok: true, pass: false, label, reason: "图片内容违规，请更换后重试" };
  }
  const now = Date.now();
  const addRes = await db.collection("garments").add({
    data: {
      _openid: openid,
      user_id: openid,
      name,
      category,
      original_file_id: fileID,
      type: "upload",
      status: "ready",
      created_at: now,
      updated_at: now
    }
  });
  return { ok: true, pass: true, garmentId: addRes._id, id: addRes._id, name, category };
}

/* 删除衣物（原图 + 对应四视图 1:1 联动）：
   - 只按当前用户拥有的 garments 记录删除（客户端 fileIDs 不再可信）；
   - 内置模板不可删；不存在/非本人记录幂等跳过。 */
async function deleteGarment(event, openid) {
  const garmentIds = requireArray(event.garmentIds || [], "garmentIds", { max: 50 }).map((v) => requireId(v, "garmentId"));
  const toDelete = new Set();
  let removedGarments = 0;
  let removedViews = 0;
  for (const id of garmentIds) {
    let doc;
    try {
      const res = await db.collection("garments").doc(id).get();
      doc = res.data;
    } catch (e) {
      continue; // 不存在：幂等跳过
    }
    const owner = (doc && (doc.user_id || doc._openid)) || "";
    if (!owner || owner !== openid || doc.type === "builtin") continue; // 非本人/内置：不可删
    if (doc.original_file_id && doc.original_file_id.indexOf("cloud://") === 0) toDelete.add(doc.original_file_id);
    try {
      await db.collection("garments").doc(id).remove();
      removedGarments++;
    } catch (e) {
      console.log("deleteGarment garment remove fail", "id=" + id, "error=" + fmtErr(e));
    }
  }
  // 四视图联动（按 garment_id + 当前用户）
  if (garmentIds.length > 0) {
    const _ = db.command;
    try {
      const res = await db.collection("garment_views")
        .where({ garment_id: _.in(garmentIds), user_id: openid })
        .limit(100)
        .get();
      for (const doc of res.data) {
        const composite = doc.views && doc.views.composite;
        if (composite && composite.indexOf("cloud://") === 0) toDelete.add(composite);
        try {
          await db.collection("garment_views").doc(doc._id).remove();
          removedViews++;
        } catch (e) {
          console.log("deleteGarment view remove fail", "id=" + doc._id, "error=" + fmtErr(e));
        }
      }
    } catch (e) {
      console.log("deleteGarment query views fail", "error=" + fmtErr(e));
    }
  }
  const fileList = Array.from(toDelete);
  for (let i = 0; i < fileList.length; i += 50) {
    const batch = fileList.slice(i, i + 50);
    try {
      await cloud.deleteFile({ fileList: batch });
    } catch (e) {
      console.log("deleteGarment deleteFile fail", "error=" + fmtErr(e));
    }
  }
  return { ok: true, removedGarments, removedViews, removedFiles: fileList.length };
}

/* 用户真实衣物列表：仅当前用户 upload + ready，返回前端所需最小字段 */
async function listGarments(event, openid) {
  const res = await db.collection("garments")
    .where({ user_id: openid, type: "upload", status: "ready" })
    .orderBy("created_at", "desc")
    .limit(100)
    .get();
  const list = (res.data || []).map((d) => {
    if (!d.category || (d.category !== "上衣" && d.category !== "裤子")) {
      console.log("listGarments invalid category", "id=" + d._id, "category=" + d.category);
      return null;
    }
    return {
      id: d._id,
      image: d.original_file_id || "",
      name: d.name || "",
      category: d.category,
      size_label: d.size_label || undefined,
      measurements: d.measurements || undefined
    };
  }).filter(Boolean);
  return { ok: true, list };
}

/* 更新衣物：保存用户当前编辑后的完整 Metadata 状态（非 PATCH） */
async function updateGarment(event, openid) {
  const garmentId = requireId(event.garmentId, "garmentId");
  const doc = await db.collection("garments").doc(garmentId).get().catch(() => ({ data: null }));
  if (!doc.data) throw appError("NOT_FOUND");
  const owner = (doc.data && (doc.data.user_id || doc.data._openid)) || "";
  if (!owner || owner !== openid || doc.data.type === "builtin") throw appError("FORBIDDEN");

  const name = requireString(event.name, "name", 20);
  const category = requireEnum(event.category, "category", CATEGORIES);
  const sizeLabel = parseSizeLabel(event.size_label);
  const measurements = parseMeasurements(event.measurements);

  const _ = db.command;
  const updates = { name, category, updated_at: Date.now() };

  if (sizeLabel !== undefined) {
    updates.size_label = sizeLabel;
  } else {
    updates.size_label = _.remove();
  }

  if (category !== "上衣") {
    updates.measurements = _.remove();
  } else if (measurements !== undefined) {
    updates.measurements = measurements;
  } else {
    updates.measurements = _.remove();
  }

  await db.collection("garments").doc(garmentId).update({ data: updates });
  const fresh = await db.collection("garments").doc(garmentId).get();
  return {
    ok: true,
    id: fresh.data._id,
    name: fresh.data.name,
    category: fresh.data.category,
    size_label: fresh.data.size_label || undefined,
    measurements: fresh.data.measurements || undefined
  };
}

exports.main = async (event) => {
  try {
    const { OPENID: openid } = cloud.getWXContext();
    requireLogin(openid);
    if (event && event.action === "list") return listGarments(event, openid);
    if (event && event.action === "deleteGarment") return deleteGarment(event, openid);
    if (event && event.action === "create") return createGarment(event, openid);
    if (event && event.action === "update") return updateGarment(event, openid);
    // 兼容旧调用：无 action 视为纯内容检测（不落库）
    const fileID = requireId(event.fileID, "fileID");
    if (fileID.indexOf("cloud://") !== 0) throw appError("INVALID_ARGUMENT", "fileID 不合法");
    const { pass, label } = await checkFile(fileID);
    return { ok: true, pass, label };
  } catch (e) {
    console.log("uploadGarment fail", "error=" + fmtErr(e));
    return { ok: false, error: e.appCode || "INTERNAL", message: e.appCode ? e.message : "内部错误" };
  }
};
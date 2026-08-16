const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

/* 删除衣物（原图 + 对应四视图 1:1 联动清理）：
   - garmentIds：衣物记录 ID（对应 garment_views.garment_id）
   - fileIDs：原图云存储文件 ID（cloud://）
   四视图是内部生成素材，不直接展示；原图删除时四视图记录与文件一并删除。 */
async function deleteGarment(event) {
  const garmentIds = Array.isArray(event.garmentIds) ? event.garmentIds : [];
  const fileIDs = Array.isArray(event.fileIDs) ? event.fileIDs : [];
  const toDelete = new Set();
  let removedViews = 0;
  try {
    // 1. 按 garment_id 查四视图记录，收集四视图云存储文件并删除记录
    if (garmentIds.length > 0) {
      const _ = db.command;
      try {
        const res = await db.collection("garment_views")
          .where({ garment_id: _.in(garmentIds) })
          .limit(100)
          .get();
        for (const doc of res.data) {
          const composite = doc.views && doc.views.composite;
          if (composite && composite.indexOf("cloud://") === 0) toDelete.add(composite);
          try {
            await db.collection("garment_views").doc(doc._id).remove();
            removedViews++;
          } catch (e) {
            console.log("deleteGarment view remove fail", "id=" + doc._id, "error=" + ((e && (e.errMsg || e.message)) || e));
          }
        }
      } catch (e) {
        // 集合不存在等视为无四视图记录
        console.log("deleteGarment query views fail", "error=" + ((e && (e.errMsg || e.message)) || e));
      }
    }
    // 2. 收集原图云存储文件
    for (const f of fileIDs) {
      if (f && f.indexOf("cloud://") === 0) toDelete.add(f);
    }
    // 3. 批量删除云存储文件（deleteFile 单次上限 50，分批）
    const fileList = Array.from(toDelete);
    for (let i = 0; i < fileList.length; i += 50) {
      const batch = fileList.slice(i, i + 50);
      try {
        const del = await cloud.deleteFile({ fileList: batch });
        console.log("deleteGarment files", "count=" + batch.length, "result=" + JSON.stringify(del && del.fileList));
      } catch (e) {
        console.log("deleteGarment deleteFile fail", "error=" + ((e && (e.errMsg || e.message)) || e));
      }
    }
    return { ok: true, removedViews, removedFiles: fileList.length };
  } catch (e) {
    console.log("deleteGarment fail", "error=" + ((e && (e.errMsg || e.message)) || e));
    return { ok: false, error: (e && (e.errMsg || e.message)) || String(e) };
  }
}

exports.main = async (event) => {
  if (event && event.action === "deleteGarment") return deleteGarment(event);
  const { fileID } = event;
  if (!fileID) return { ok: false, error: "fileID 必填" };
  try {
    // 下载云存储图片 → 微信内容安全检测（C-04）
    const dl = await cloud.downloadFile({ fileID });
    const res = await cloud.openapi.security.imgSecCheck({
      media: { contentType: "image/png", value: dl.fileContent }
    });
    const pass = !res || res.errCode === 0;
    console.log("uploadGarment check", "fileID=" + fileID, "pass=" + pass);
    return { ok: true, pass, label: (res && res.result && res.result.label) || 0 };
  } catch (e) {
    // 87014 = 内容违规（微信标准错误码）
    if (e && e.errCode === 87014) {
      return { ok: true, pass: false, label: 100, reason: "图片内容违规，请更换后重试" };
    }
    console.log("uploadGarment check fail", "error=" + ((e && (e.errMsg || e.message)) || e));
    return { ok: false, error: (e && (e.errMsg || e.message)) || String(e) };
  }
};

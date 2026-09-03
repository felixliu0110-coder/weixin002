/* 服务端衣物解析：优先 garments 集合（用户上传衣物），内置模板白名单兜底。
   客户端只提交 garmentIds；name/category/original_file_id 一律由服务端取得，
   客户端传入的 garmentName/garmentImage/fileID 不作为生成或授权依据。
   displayImage 为 UI 展示资源，referenceAsset 为 Provider 可信资源。 */
const { appError } = require("./errors");
const { getBuiltinGarment } = require("./builtinGarments");

async function resolveGarment(db, garmentId, openid) {
  const builtin = getBuiltinGarment(garmentId);
  if (builtin) {
    return {
      id: garmentId,
      name: builtin.name,
      category: builtin.category,
      type: "builtin",
      displayImage: builtin.displayImage || "",
      referenceAsset: null
    };
  }
  if (!openid) throw appError("AUTH_REQUIRED");
  let doc;
  try {
    const res = await db.collection("garments").doc(garmentId).get();
    doc = res.data;
  } catch (e) {
    throw appError("NOT_FOUND");
  }
  const owner = (doc && (doc.user_id || doc._openid)) || "";
  if (!owner || owner !== openid) throw appError("FORBIDDEN");
  if (!doc.category) throw appError("INVALID_GARMENT_CATEGORY");
  if (doc.category !== "上衣" && doc.category !== "裤子") throw appError("INVALID_GARMENT_CATEGORY");
  const fileId = doc.original_file_id || "";
  return {
    id: garmentId,
    name: doc.name || "未命名衣物",
    category: doc.category,
    type: "upload",
    displayImage: fileId,
    referenceAsset: fileId ? { kind: "cloud-file", fileId: fileId } : null
  };
}

async function resolveGarments(db, garmentIds, openid) {
  return Promise.all(garmentIds.map((id) => resolveGarment(db, id, openid)));
}

/* 判断 garment 是否有可信 Provider reference */
function hasProviderReference(garment) {
  if (!garment || !garment.referenceAsset) return false;
  if (garment.referenceAsset.kind === "cloud-file") {
    return !!garment.referenceAsset.fileId;
  }
  return false;
}

module.exports = { resolveGarment, resolveGarments, hasProviderReference };

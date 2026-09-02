/* 云函数端资源归属校验：身份一律来自云函数上下文（cloud.getWXContext().openid）。
   客户端传入的 openid/user_id/fileID/URL 一律不作为授权依据。
   规则：未登录 -> AUTH_REQUIRED；资源不存在 -> NOT_FOUND；
   资源归属非当前用户或缺少归属字段 -> FORBIDDEN（旧数据缺归属视为不可访问）。 */
const { appError } = require("./errors");
const { normalizeUserField } = require("./validation");

function assertOwner(doc, openid) {
  if (!doc) throw appError("NOT_FOUND");
  if (!openid) throw appError("AUTH_REQUIRED");
  const owner = normalizeUserField(doc);
  if (!owner) throw appError("FORBIDDEN", "资源缺少归属");
  if (owner !== openid) throw appError("FORBIDDEN");
  return doc;
}

async function getOwnedDoc(db, collName, docId, openid) {
  if (!docId || typeof docId !== "string") throw appError("INVALID_ARGUMENT", "docId 不合法");
  let res;
  try {
    res = await db.collection(collName).doc(docId).get();
  } catch (e) {
    throw appError("NOT_FOUND");
  }
  return assertOwner(res.data, openid);
}

/* 按 user_id + query 查最新一条并做归属断言（查询本身已按当前用户过滤） */
async function getOwnedFirst(db, collName, query, openid, opts) {
  if (!openid) throw appError("AUTH_REQUIRED");
  const res = await db.collection(collName)
    .where(Object.assign({ user_id: openid }, query))
    .orderBy("createdAt", "desc")
    .limit((opts && opts.limit) || 1)
    .get();
  if (!res.data || res.data.length === 0) throw appError("NOT_FOUND");
  return assertOwner(res.data[0], openid);
}

module.exports = { assertOwner, getOwnedDoc, getOwnedFirst };

/* 参数校验工具（模型无关，可单测） */
const { appError } = require("./errors");

function requireLogin(openid) {
  if (!openid) throw appError("AUTH_REQUIRED");
  return openid;
}

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim() !== "";
}

function requireString(value, name, maxLen) {
  if (!isNonEmptyString(value)) throw appError("INVALID_ARGUMENT", name + " 必填");
  if (maxLen && value.length > maxLen) throw appError("INVALID_ARGUMENT", name + " 过长");
  return value.trim();
}

function requireId(value, name) {
  return requireString(value, name, 128);
}

function requireArray(value, name, opts) {
  const o = opts || {};
  if (!Array.isArray(value)) throw appError("INVALID_ARGUMENT", name + " 必须为数组");
  if (o.min && value.length < o.min) throw appError("INVALID_ARGUMENT", name + " 数量不足");
  if (o.max && value.length > o.max) throw appError("INVALID_ARGUMENT", name + " 数量超限");
  return value;
}

function requireInt(value, name, opts) {
  const n = Number(value);
  const o = opts || {};
  if (!Number.isFinite(n) || (o.min !== undefined && n < o.min) || (o.max !== undefined && n > o.max)) {
    throw appError("INVALID_ARGUMENT", name + " 不合法");
  }
  return Math.trunc(n);
}

function requireEnum(value, name, allowed) {
  if (!allowed.includes(value)) throw appError("INVALID_ARGUMENT", name + " 取值不合法");
  return value;
}

/* 统一用户归属字段：优先 user_id，兼容旧 _openid；无归属返回 "" */
function normalizeUserField(doc) {
  return (doc && (doc.user_id || doc._openid)) || "";
}

module.exports = {
  requireLogin,
  requireString,
  requireId,
  requireArray,
  requireInt,
  requireEnum,
  normalizeUserField,
  isNonEmptyString
};

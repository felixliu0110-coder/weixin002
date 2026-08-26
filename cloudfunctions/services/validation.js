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

const MEASUREMENT_FIELDS = ["lengthCm", "chestWidthCm", "shoulderWidthCm", "sleeveLengthCm"];

function parseSizeLabel(value) {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") throw appError("INVALID_ARGUMENT", "size_label 必须为字符串");
  const trimmed = value.trim();
  if (trimmed === "") return undefined;
  if (trimmed.length > 20) throw appError("INVALID_ARGUMENT", "size_label 过长");
  return trimmed;
}

function parseMeasurements(value) {
  if (value === undefined || value === null) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw appError("INVALID_ARGUMENT", "measurements 必须为对象");
  }
  const keys = Object.keys(value);
  if (keys.length === 0) return undefined;
  for (const k of keys) {
    if (!MEASUREMENT_FIELDS.includes(k)) {
      throw appError("INVALID_ARGUMENT", "measurements 包含未知字段: " + k);
    }
    const v = value[k];
    if (typeof v !== "number" || !Number.isFinite(v) || v <= 0 || v > 300) {
      throw appError("INVALID_ARGUMENT", "measurements." + k + " 不合法");
    }
  }
  const result = {};
  for (const k of keys) result[k] = value[k];
  return result;
}

module.exports = {
  requireLogin,
  requireString,
  requireId,
  requireArray,
  requireInt,
  requireEnum,
  normalizeUserField,
  isNonEmptyString,
  MEASUREMENT_FIELDS,
  parseSizeLabel,
  parseMeasurements
};

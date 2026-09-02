/* 统一业务错误码与格式化工具（模型无关，可单测） */
const ERR = {
  AUTH_REQUIRED: { code: "AUTH_REQUIRED", message: "请先登录", http: 401 },
  FORBIDDEN: { code: "FORBIDDEN", message: "无权访问该资源", http: 403 },
  NOT_FOUND: { code: "NOT_FOUND", message: "资源不存在", http: 404 },
  INVALID_ARGUMENT: { code: "INVALID_ARGUMENT", message: "参数不合法", http: 400 },
  CONFLICT: { code: "CONFLICT", message: "状态冲突", http: 409 },
  RATE_LIMITED: { code: "RATE_LIMITED", message: "请求过于频繁", http: 429 },
  PAYLOAD_TOO_LARGE: { code: "PAYLOAD_TOO_LARGE", message: "文件过大", http: 413 },
  PROVIDER_ERROR: { code: "PROVIDER_ERROR", message: "AI 服务暂不可用", http: 502 },
  INTERNAL: { code: "INTERNAL", message: "内部错误", http: 500 }
};

function appError(key, message) {
  const meta = ERR[key] || ERR.INTERNAL;
  const err = new Error(message || meta.message);
  err.appCode = meta.code;
  err.httpStatus = meta.http;
  return err;
}

function isAppError(e) {
  return !!(e && e.appCode);
}

function fmtErr(e) {
  if (!e) return "unknown";
  if (e.appCode) return e.appCode + ": " + (e.message || "");
  const detail = (e && (e.errMsg || e.message)) ? String(e.errMsg || e.message) : "";
  return detail || String(e);
}

module.exports = { ERR, appError, isAppError, fmtErr };

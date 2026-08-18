const crypto = require("crypto");
const cloud = require("wx-server-sdk");
const { handleCallback } = require("./callback");
const { appError, fmtErr } = require("./errors");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

/* 回调鉴权：请求必须携带与 CALLBACK_SECRET 一致的 secret（不可猜测、可轮换）。
   说明：当前 AI Provider（Agnes）为主动轮询模式、无官方回调协议；
   本函数作为内部/预留回调入口，未配置 CALLBACK_SECRET 时拒绝所有回调。 */
function verifySecret(event) {
  const secret = process.env.CALLBACK_SECRET || "";
  if (!secret) throw appError("INTERNAL", "回调密钥未配置");
  const provided = event && event.secret;
  if (typeof provided !== "string" || provided.length !== secret.length) throw appError("FORBIDDEN");
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(secret, "utf8");
  if (!crypto.timingSafeEqual(a, b)) throw appError("FORBIDDEN");
}

exports.main = async (event) => {
  try {
    verifySecret(event);
    return await handleCallback({ db, taskId: event.taskId, status: event.status, result: event.result });
  } catch (e) {
    console.log("onTryonComplete fail", "error=" + fmtErr(e));
    return { ok: false, error: e.appCode || "INTERNAL", message: e.appCode ? e.message : "内部错误" };
  }
};

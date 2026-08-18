/* 试穿任务状态机（模型无关，可单测）：
   queued -> processing -> success
   queued -> failed
   processing -> failed
   queued/processing -> cancelled
   拒绝其他非法跳转。 */
const { appError } = require("./errors");

const ALLOWED_TRANSITIONS = {
  queued: ["processing", "failed", "cancelled"],
  processing: ["success", "failed", "cancelled"],
  success: [],
  failed: [],
  cancelled: []
};

function canTransition(from, to) {
  if (!from || !to) return false;
  const allowed = ALLOWED_TRANSITIONS[from];
  return !!(allowed && allowed.includes(to));
}

function assertTransition(from, to) {
  if (!canTransition(from, to)) {
    throw appError("CONFLICT", "非法状态跳转：" + (from || "?") + " -> " + (to || "?"));
  }
  return to;
}

function normalizeStatus(s) {
  return s === "queued" || s === "processing" || s === "success" || s === "failed" || s === "cancelled" ? s : null;
}

module.exports = { ALLOWED_TRANSITIONS, canTransition, assertTransition, normalizeStatus };

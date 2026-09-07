/* 服务端每日额度（事务防并发超扣，失败回补策略由调用方决定） */
const { appError } = require("./errors");

const DEFAULT_DAILY_LIMIT = 3;

function dateStr(ts) {
  // 东八区日期 YYYY-MM-DD
  const d = new Date((ts || Date.now()) + 8 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

function quotaDocId(openid, date) {
  return "q_" + openid + "_" + date;
}

/* 原子扣减 1 次：并发下不会超扣；超限抛 RATE_LIMITED */
async function consumeQuota(db, openid, date, limit) {
  if (!openid) throw appError("AUTH_REQUIRED");
  const docId = quotaDocId(openid, date);
  const max = limit || DEFAULT_DAILY_LIMIT;
  let lastErr = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await db.runTransaction(async (t) => {
        let d = null;
        try {
          const r = await t.collection("quotas").doc(docId).get();
          d = r.data;
        } catch (e) {
          d = null; // 不存在：首次创建
        }
        const used = (d && typeof d.used === "number" ? d.used : 0) + 1;
        if (used > max) throw appError("RATE_LIMITED", "今日免费额度已用完，请明日再试");
        const now = Date.now();
        await t.collection("quotas").doc(docId).set({
          data: {
            _openid: openid,
            user_id: openid,
            date,
            used,
            limit: max,
            // consume 使用 set() 重写文档时必须保留退款幂等账本，
            // 否则一次新的正常消费会抹掉历史 taskId，导致旧任务重复退款。
            refund_task_ids: Array.isArray(d && d.refund_task_ids) ? d.refund_task_ids.slice() : [],
            created_at: d ? (d.created_at || now) : now,
            updated_at: now
          }
        });
        return { used, limit: max };
      });
    } catch (e) {
      if (e && e.appCode === "RATE_LIMITED") throw e;
      lastErr = e;
      // 事务冲突/瞬时错误：重试
    }
  }
  throw lastErr || appError("INTERNAL", "额度扣减失败");
}

/*
 * 回补 1 次（Provider 失败策略）。
 * 幂等边界由 taskId 负责：同一个任务重复回补不会重复减少 used。
 * 使用同一 quotas 文档事务化读写，兼容并发失败回补。
 */
async function refundQuota(db, openid, date, taskId) {
  if (!openid) return { refunded: false, reason: "no-openid" };
  if (!taskId) throw appError("INVALID_ARGUMENT", "额度回补缺少 taskId");

  const docId = quotaDocId(openid, date);
  let lastErr = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    let tx = null;
    try {
      tx = await db.startTransaction();
      const ref = tx.collection("quotas").doc(docId);
      let d = null;
      try {
        const r = await ref.get();
        d = r.data || null;
      } catch (e) {
        d = null;
      }
      if (!d) {
        await tx.rollback();
        return { refunded: false, reason: "quota-not-found" };
      }

      const refundedTasks = Array.isArray(d.refund_task_ids) ? d.refund_task_ids.slice() : [];
      if (refundedTasks.includes(taskId)) {
        await tx.commit();
        return { refunded: false, idempotent: true, used: Math.max(0, Number(d.used) || 0) };
      }

      const used = Math.max(0, Number(d.used) || 0);
      const nextUsed = Math.max(0, used - 1);
      // 回补后的额度可以再次被消费，因此一天内合法的退款任务数可能超过 daily limit。
      // 不能只保留最近 limit 个 ID，否则较早任务再次重试退款会发生重复回补。
      const nextRefundedTasks = refundedTasks.includes(taskId)
        ? refundedTasks
        : refundedTasks.concat(taskId);
      const now = Date.now();
      await ref.update({
        data: {
          used: nextUsed,
          refund_task_ids: nextRefundedTasks,
          updated_at: now
        }
      });
      await tx.commit();
      return { refunded: true, used: nextUsed };
    } catch (e) {
      if (tx) {
        try { await tx.rollback(); } catch (_e) {}
      }
      lastErr = e;
    }
  }
  throw lastErr || appError("INTERNAL", "额度回补失败");
}

/* 查询当日额度 */
async function getQuota(db, openid, date) {
  if (!openid) throw appError("AUTH_REQUIRED");
  try {
    const r = await db.collection("quotas").doc(quotaDocId(openid, date)).get();
    const d = r.data;
    return { userId: openid, dailyFree: d.limit || DEFAULT_DAILY_LIMIT, used: d.used || 0, date: d.date || date };
  } catch (e) {
    return { userId: openid, dailyFree: DEFAULT_DAILY_LIMIT, used: 0, date };
  }
}

module.exports = { DEFAULT_DAILY_LIMIT, dateStr, quotaDocId, consumeQuota, refundQuota, getQuota };

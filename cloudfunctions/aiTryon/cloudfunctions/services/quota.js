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

/* 回补 1 次（Provider 失败策略：不重复扣费）。幂等由调用方保证（按任务去重）。 */
async function refundQuota(db, openid, date) {
  if (!openid) return;
  const _ = db.command;
  try {
    await db.collection("quotas").doc(quotaDocId(openid, date)).update({
      data: { used: _.inc(-1), updated_at: Date.now() }
    });
  } catch (e) {
    // 文档不存在等：忽略
  }
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

const cloud = require("wx-server-sdk");
const { getAigc } = require("./aigc");
const { buildAvatarViewsPrompt } = require("./avatarViews");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

function fmtErr(e) {
  const detail = (e && e.message) ? e.message : String(e);
  return (e && e.code) ? e.code + ": " + detail : detail;
}

exports.main = async (event) => {
  const { openid } = cloud.getWXContext();
  // 查询最新三视图：云函数管理权限读取，按 user_id 归属过滤（openid 为空时取最新一条，兼容测试环境）
  if (event.action === "get") {
    try {
      const coll = db.collection("avatar_views");
      let res;
      if (openid) {
        res = await coll.where({ user_id: openid }).orderBy("createdAt", "desc").limit(1).get();
      } else {
        res = await coll.orderBy("createdAt", "desc").limit(1).get();
      }
      if (res.data.length === 0) return { ok: true, empty: true };
      const d = res.data[0];
      return { ok: true, avatarViewId: d._id, status: d.status, views: d.views, provider: d.provider };
    } catch (e) {
      return { ok: false, error: e.code || e.message };
    }
  }
  const profile = event.profile || {};
  const aigc = getAigc();
  const prompt = buildAvatarViewsPrompt(profile);
  try {
    const res = await aigc.generateImages({ prompt, refImages: event.refImages || [], count: 1 });
    const doc = {
      _openid: openid,
      user_id: openid,
      profile_snapshot: profile,
      views: { composite: res.urls[0] },
      provider: res.provider,
      status: "ready",
      createdAt: Date.now()
    };
    const addRes = await db.collection("avatar_views").add({ data: doc });
    return { ok: true, avatarViewId: addRes._id, status: "ready", views: doc.views };
  } catch (e) {
    return { ok: false, error: fmtErr(e) };
  }
};

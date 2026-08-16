const cloud = require("wx-server-sdk");
const { getAigc } = require("./aigc");
const { buildAvatarViewsPrompt } = require("./avatarViews");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { openid } = cloud.getWXContext();
  const profile = event.profile || {};
  const aigc = getAigc();
  const prompt = buildAvatarViewsPrompt(profile);
  try {
    const res = await aigc.generateImages({ prompt, refImages: event.refImages || [], count: 1 });
    const doc = {
      user_id: openid,
      profile_snapshot: profile,
      views: { composite: res.urls[0] },
      provider: res.provider,
      status: "ready",
      created_at: Date.now()
    };
    const addRes = await db.collection("avatar_views").add({ data: doc });
    return { ok: true, avatarViewId: addRes._id, status: "ready", views: doc.views };
  } catch (e) {
    return { ok: false, error: e.code || e.message };
  }
};

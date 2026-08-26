const cloud = require("wx-server-sdk");
const { getAigc } = require("../services/aigc");
const { buildAvatarViewsPrompt } = require("../services/avatarViews");
const { saveRemoteImage } = require("../services/storage");
const { requireLogin, requireId } = require("../services/validation");
const { getOwnedDoc } = require("../services/ownership");
const { fmtErr } = require("../services/errors");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  try {
    const { OPENID: openid } = cloud.getWXContext();
    requireLogin(openid);
    // 查询最新三视图：云函数管理权限读取，严格按当前用户归属过滤
    if (event.action === "get") {
      const coll = db.collection("avatar_views");
      // 兼容新旧时间字段（created_at / createdAt）：本地取最新
      const res = await coll.where({ user_id: openid }).limit(10).get();
      let best = null;
      let bestTs = 0;
      for (const d of res.data) {
        const ts = d.created_at || d.createdAt || 0;
        if (!best || ts > bestTs) { best = d; bestTs = ts; }
      }
      if (!best) return { ok: true, empty: true };
      return { ok: true, avatarViewId: best._id, status: best.status, views: best.views, provider: best.provider };
    }
    // 客户端只传档案业务 ID：服务端查询 → owner check → 从档案取照片 fileID → 临时 URL → AI
    const profileId = requireId(event.profileId || (event.profile && event.profile.id), "profileId");
    const profile = await getOwnedDoc(db, "avatar_profiles", profileId, openid);
    const aigc = getAigc();
    // 用户照片必须来自档案中的云存储 fileID；客户端任意 URL 不作为参考图
    const photoIds = [
      profile.face_photo_id || profile.facePhoto,
      profile.body_photo_id || profile.bodyPhoto
    ].filter((v) => v && v.indexOf("cloud://") === 0);
    let refImages = [];
    if (photoIds.length > 0) {
      try {
        const tf = await cloud.getTempFile({ fileList: photoIds });
        const map = {};
        for (const f of tf.fileList || []) {
          if (f.tempFileURL) map[f.fileID] = f.tempFileURL;
        }
        refImages = photoIds.map((id) => map[id]).filter(Boolean);
      } catch (e) {
        console.log("createAvatarViews getTempFile fail", "error=" + fmtErr(e));
      }
    }
    // 参考图数量传入提示词：有参考图时锚定"面部发型与参考图一致"
    const prompt = buildAvatarViewsPrompt(profile, refImages.length);
    const res = await aigc.generateImages({ prompt, refImages, count: 1 });
    let composite = res.urls[0];
    try {
      composite = await saveRemoteImage(res.urls[0], "avatar_views");
    } catch (e) {
      console.log("createAvatarViews storage save fail", "error=" + e.message);
    }
    const doc = {
      _openid: openid,
      user_id: openid,
      avatar_profile_id: profileId,
      profile_snapshot: profile,
      views: { composite },
      provider: res.provider,
      status: "ready",
      created_at: Date.now(),
      updated_at: Date.now()
    };
    const addRes = await db.collection("avatar_views").add({ data: doc });
    return { ok: true, avatarViewId: addRes._id, status: "ready", views: doc.views };
  } catch (e) {
    console.log("createAvatarViews fail", "error=" + fmtErr(e));
    return { ok: false, error: e.appCode || "INTERNAL", message: e.appCode ? e.message : "内部错误" };
  }
};

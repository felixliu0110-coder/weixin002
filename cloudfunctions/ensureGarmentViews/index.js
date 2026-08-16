const cloud = require("wx-server-sdk");
const { getAigc } = require("./aigc");
const { buildGarmentViewsPrompt } = require("./garmentViews");
const { saveRemoteImage } = require("./storage");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

function fmtErr(e) {
  const detail = (e && e.message) ? e.message : String(e);
  return (e && e.code) ? e.code + ": " + detail : detail;
}

exports.main = async (event) => {
  const { openid } = cloud.getWXContext();
  const { garmentId, garmentName, garmentImage } = event;
  if (!garmentId || !garmentName) {
    return { ok: false, error: "garmentId/garmentName 必填" };
  }
  try {
    // 缓存命中直接返回
    const cached = await db.collection("garment_views").where({ garment_id: garmentId }).limit(1).get();
    if (cached.data.length > 0 && cached.data[0].status === "ready") {
      return { ok: true, cached: true, garmentViewId: cached.data[0]._id, status: "ready", views: cached.data[0].views };
    }
    const aigc = getAigc();
    const prompt = buildGarmentViewsPrompt(garmentName);
    const res = await aigc.generateImages({ prompt, refImages: garmentImage ? [garmentImage] : [], count: 1 });
    let composite = res.urls[0];
    try {
      composite = await saveRemoteImage(res.urls[0], "garment_views");
    } catch (e) {
      console.log("ensureGarmentViews storage save fail", "error=" + e.message);
    }
    const doc = {
      _openid: openid,
      garment_id: garmentId,
      user_id: openid,
      views: { composite },
      provider: res.provider,
      status: "ready",
      createdAt: Date.now()
    };
    const addRes = await db.collection("garment_views").add({ data: doc });
    return { ok: true, cached: false, garmentViewId: addRes._id, status: "ready", views: doc.views };
  } catch (e) {
    return { ok: false, error: fmtErr(e) };
  }
};

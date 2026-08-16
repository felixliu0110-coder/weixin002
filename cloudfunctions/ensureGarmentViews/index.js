const cloud = require("wx-server-sdk");
const { getAigc } = require("./services/aigc");
const { buildGarmentViewsPrompt } = require("./services/templates/garmentViews");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

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
    const doc = {
      garment_id: garmentId,
      user_id: openid,
      views: { composite: res.urls[0] },
      provider: res.provider,
      status: "ready",
      created_at: Date.now()
    };
    const addRes = await db.collection("garment_views").add({ data: doc });
    return { ok: true, cached: false, garmentViewId: addRes._id, status: "ready", views: doc.views };
  } catch (e) {
    return { ok: false, error: e.code || e.message };
  }
};

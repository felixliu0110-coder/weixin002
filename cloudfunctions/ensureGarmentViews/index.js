const cloud = require("wx-server-sdk");
const { getAigc } = require("./aigc");
const { buildGarmentViewsPrompt } = require("./garmentViews");
const { saveRemoteImage } = require("./storage");
const { requireLogin, requireId } = require("./validation");
const { resolveGarment } = require("./garments");
const { fmtErr } = require("./errors");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  try {
    const { openid } = cloud.getWXContext();
    requireLogin(openid);
    const garmentId = requireId(event.garmentId, "garmentId");
    // 衣物信息由服务端解析（内置模板白名单 / garments 集合），不信任客户端 garmentName/garmentImage
    const garment = await resolveGarment(db, garmentId, openid);
    // 缓存命中直接返回（严格按当前用户隔离）
    const cached = await db.collection("garment_views")
      .where({ garment_id: garmentId, user_id: openid })
      .limit(1)
      .get();
    if (cached.data.length > 0 && cached.data[0].status === "ready") {
      return { ok: true, cached: true, garmentViewId: cached.data[0]._id, status: "ready", views: cached.data[0].views };
    }
    // 参考图：上传衣物从库取 original_file_id 换临时 URL；内置模板无参考图
    let refImage = "";
    if (garment.originalFileId) {
      try {
        const tf = await cloud.getTempFile({ fileList: [garment.originalFileId] });
        refImage = (tf.fileList && tf.fileList[0] && tf.fileList[0].tempFileURL) || "";
      } catch (e) {
        console.log("ensureGarmentViews getTempFile fail", "error=" + fmtErr(e));
      }
    }
    const aigc = getAigc();
    // 原图传入提示词锚定：有参考图时要求四视图与原图款式完全一致
    const prompt = buildGarmentViewsPrompt(garment.name, refImage ? 1 : 0);
    const res = await aigc.generateImages({ prompt, refImages: refImage ? [refImage] : [], count: 1 });
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
      garment_name: garment.name,
      views: { composite },
      provider: res.provider,
      status: "ready",
      created_at: Date.now(),
      updated_at: Date.now()
    };
    const addRes = await db.collection("garment_views").add({ data: doc });
    return { ok: true, cached: false, garmentViewId: addRes._id, status: "ready", views: doc.views };
  } catch (e) {
    console.log("ensureGarmentViews fail", "error=" + fmtErr(e));
    return { ok: false, error: e.appCode || "INTERNAL", message: e.appCode ? e.message : "内部错误" };
  }
};

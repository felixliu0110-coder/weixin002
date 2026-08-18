const cloud = require("wx-server-sdk");
const { requireLogin, requireEnum, requireInt, requireString } = require("./validation");
const { appError, fmtErr } = require("./errors");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

/* 查询当前用户最新档案（兼容 created_at/createdAt） */
async function profileGet(openid) {
  const res = await db.collection("avatar_profiles").where({ user_id: openid }).limit(10).get();
  let best = null;
  let bestTs = 0;
  for (const d of res.data || []) {
    const ts = d.created_at || d.createdAt || 0;
    if (!best || ts > bestTs) { best = d; bestTs = ts; }
  }
  if (!best) return { ok: true, empty: true };
  return {
    ok: true,
    profile: {
      id: best._id,
      gender: best.gender,
      heightCm: best.heightCm,
      weightKg: best.weightKg,
      bustCm: best.bustCm,
      waistCm: best.waistCm,
      hipCm: best.hipCm,
      legLengthCm: best.legLengthCm,
      neckLengthCm: best.neckLengthCm,
      shoulderCm: best.shoulderCm,
      armLengthCm: best.armLengthCm,
      shoeSize: best.shoeSize,
      skinTone: best.skinTone,
      estimate: best.estimate,
      face_photo_id: best.face_photo_id || best.facePhoto || "",
      body_photo_id: best.body_photo_id || best.bodyPhoto || ""
    }
  };
}

/* 保存/更新当前用户档案（服务端校验字段；照片只接受云存储 fileID） */
async function profileSave(event, openid) {
  const data = {};
  if (event.gender !== undefined) data.gender = requireEnum(event.gender, "gender", ["female", "male"]);
  for (const k of ["heightCm", "weightKg", "bustCm", "waistCm", "hipCm", "legLengthCm", "neckLengthCm", "shoulderCm", "armLengthCm", "shoeSize"]) {
    if (event[k] !== undefined) data[k] = requireInt(event[k], k, { min: 0, max: 300 });
  }
  if (event.skinTone !== undefined) data.skinTone = requireString(event.skinTone, "skinTone", 20);
  if (event.estimate !== undefined) data.estimate = !!event.estimate;
  const photo = (v) => {
    if (!v) return "";
    if (v.indexOf("cloud://") !== 0) throw appError("INVALID_ARGUMENT", "照片字段只接受云存储文件");
    return v;
  };
  if (event.face_photo_id !== undefined) data.face_photo_id = photo(event.face_photo_id);
  else if (event.facePhoto !== undefined) data.face_photo_id = photo(event.facePhoto);
  if (event.body_photo_id !== undefined) data.body_photo_id = photo(event.body_photo_id);
  else if (event.bodyPhoto !== undefined) data.body_photo_id = photo(event.bodyPhoto);
  const now = Date.now();
  data.updated_at = now;
  const res = await db.collection("avatar_profiles").where({ user_id: openid }).limit(10).get();
  let best = null;
  let bestTs = 0;
  for (const d of res.data || []) {
    const ts = d.created_at || d.createdAt || 0;
    if (!best || ts > bestTs) { best = d; bestTs = ts; }
  }
  if (best) {
    await db.collection("avatar_profiles").doc(best._id).update({ data: Object.assign({ user_id: openid }, data) });
    return { ok: true, id: best._id };
  }
  const add = await db.collection("avatar_profiles").add({
    data: Object.assign({ _openid: openid, user_id: openid, created_at: now }, data)
  });
  return { ok: true, id: add._id };
}

exports.main = async (event) => {
  try {
    const { openid } = cloud.getWXContext();

    console.log(
      "auth context",
      "action=" + (event.action || ""),
      "openid=" + (openid ? "set" : "EMPTY")
    );

    // 登录接口：不能先要求登录
    if (event.action === "login") {
      if (!openid) {
        return {
          ok: false,
          error: "AUTH_REQUIRED",
          message: "无法获取微信用户身份"
        };
      }

      return {
        ok: true,
        loggedIn: true,
        openid,
        ts: Date.now()
      };
    }

    // 业务接口才要求登录
    requireLogin(openid);

    if (event.action === "profileGet") {
      return profileGet(openid);
    }

    if (event.action === "profileSave") {
      return profileSave(event, openid);
    }

    return {
      ok: false,
      error: "INVALID_ACTION",
      message: "未知操作"
    };
  } catch (e) {
    console.log("auth fail", "error=" + fmtErr(e));

    return {
      ok: false,
      error: e.appCode || "INTERNAL",
      message: e.appCode ? e.message : "内部错误"
    };
  }
};

/* 数据访问层：配置云开发环境 ID 后自动使用云数据库，未配置/出错时回退本地 mock。
   云数据库集合：avatar_profiles、tryon_tasks、tryon_results、favorites、quotas */
const mock = require("./mock");
const config = require("../config");

function cloudReady() {
  return typeof wx !== "undefined" && wx.cloud && config.cloudEnv && config.cloudEnv.trim() !== "";
}

function db() {
  return wx.cloud.database();
}

function fmtDate(ts) {
  const d = new Date(ts);
  return (d.getMonth() + 1) + "月" + d.getDate() + "日";
}

async function firstDoc(collName) {
  const res = await db().collection(collName).limit(1).get();
  return res.data && res.data.length > 0 ? res.data[0] : null;
}

module.exports = {
  async getAvatarProfile() {
    if (!cloudReady()) return mock.getAvatarProfile();
    try {
      const doc = await firstDoc("avatar_profiles");
      if (!doc) return mock.getAvatarProfile();
      return {
        id: doc._id,
        gender: doc.gender,
        heightCm: doc.heightCm,
        weightKg: doc.weightKg,
        bustCm: doc.bustCm,
        waistCm: doc.waistCm,
        hipCm: doc.hipCm,
        legLengthCm: doc.legLengthCm,
        isExample: false
      };
    } catch (e) {
      return mock.getAvatarProfile();
    }
  },

  async saveAvatarProfile(data) {
    if (!cloudReady()) return mock.saveAvatarProfile(data);
    try {
      const coll = db().collection("avatar_profiles");
      const doc = await firstDoc("avatar_profiles");
      if (doc) {
        await coll.doc(doc._id).update({ data });
      } else {
        await coll.add({ data: Object.assign({}, data, { createdAt: Date.now() }) });
      }
      return { ok: true };
    } catch (e) {
      return mock.saveAvatarProfile(data);
    }
  },

  getGarmentTemplates: mock.getGarmentTemplates,
  getHomeTemplates: mock.getHomeTemplates,

  uploadGarment: mock.uploadGarment,

  async submitTryon(params) {
    if (!cloudReady()) return mock.submitTryon(params);
    try {
      const task = {
        avatarId: params.avatarId,
        garmentId: params.garmentId,
        pose: params.pose || "front",
        status: "success",
        resultUrls: ["/assets/img/p07-result.jpg"],
        createdAt: Date.now()
      };
      const res = await db().collection("tryon_tasks").add({ data: task });
      return { taskId: res._id, status: "success", pose: task.pose, resultUrls: task.resultUrls };
    } catch (e) {
      return mock.submitTryon(params);
    }
  },

  async getTryonStatus(taskId) {
    if (!cloudReady()) return mock.getTryonStatus(taskId);
    try {
      const res = await db().collection("tryon_tasks").doc(taskId).get();
      return { taskId, status: res.data.status };
    } catch (e) {
      return mock.getTryonStatus(taskId);
    }
  },

  async getHistory() {
    if (!cloudReady()) return mock.getHistory();
    try {
      const res = await db().collection("tryon_results").orderBy("createdAt", "desc").limit(50).get();
      if (res.data.length === 0) return mock.getHistory();
      return res.data.map((d) => ({
        id: d._id,
        garmentName: d.garmentName,
        date: fmtDate(d.createdAt),
        image: d.image,
        aiTagged: true
      }));
    } catch (e) {
      return mock.getHistory();
    }
  },

  async getFavorites() {
    if (!cloudReady()) return mock.getFavorites();
    try {
      const res = await db().collection("favorites").orderBy("createdAt", "desc").limit(50).get();
      if (res.data.length === 0) return mock.getFavorites();
      return res.data.map((d) => ({
        id: d._id,
        garmentName: d.garmentName,
        date: fmtDate(d.createdAt),
        image: d.image,
        aiTagged: true
      }));
    } catch (e) {
      return mock.getFavorites();
    }
  },

  async getQuota() {
    if (!cloudReady()) return mock.getQuota();
    try {
      const doc = await firstDoc("quotas");
      if (!doc) return mock.getQuota();
      return { userId: doc._openid, dailyFree: doc.dailyFree, used: doc.used, isExample: false };
    } catch (e) {
      return mock.getQuota();
    }
  },

  async saveResult(result) {
    if (!cloudReady()) return mock.saveResult(result);
    try {
      const item = {
        garmentName: result.garmentName || "新收藏试穿",
        image: result.image || "/assets/img/p07-result.jpg",
        saved: result.saved !== false,
        createdAt: Date.now()
      };
      const res = await db().collection("favorites").add({ data: item });
      return { ok: true, id: res._id };
    } catch (e) {
      return mock.saveResult(result);
    }
  },

  async deleteUserData() {
    if (!cloudReady()) return mock.deleteUserData();
    try {
      for (const collName of ["avatar_profiles", "tryon_tasks", "tryon_results", "favorites", "quotas"]) {
        const coll = db().collection(collName);
        const res = await coll.get();
        for (const doc of res.data) {
          await coll.doc(doc._id).remove();
        }
      }
      return { ok: true };
    } catch (e) {
      return mock.deleteUserData();
    }
  }
};

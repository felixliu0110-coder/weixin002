/* 数据访问层：配置云开发环境 ID 后自动使用云数据库，未配置/出错时回退本地 mock。
   云数据库集合：avatar_profiles、tryon_tasks、tryon_results、favorites、quotas */
const mock = require("./mock");
const config = require("../config");

function cloudReady() {
  return typeof wx !== "undefined" && wx.cloud && config.cloudEnv && config.cloudEnv.trim() !== "";
}

function mockAllowed() {
  return config.mockEnabled === true;
}

function serviceError(message) {
  const e = new Error(message || "服务暂不可用，请稍后重试");
  e.appCode = "SERVICE_UNAVAILABLE";
  return e;
}

function isMockResult(r) {
  // 云函数未配置 AIGC Key 时返回占位 URL（provider=mock / placeholder），前端回退本地素材
  if (!r) return true;
  const s = JSON.stringify(r);
  return r.provider === "mock" || s.indexOf("placeholder.example.com") >= 0;
}

function isPublicHttpUrl(url) {
  return typeof url === "string" && /^https?:\/\//i.test(url);
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
    if (!cloudReady()) {
      if (mockAllowed()) return mock.getAvatarProfile();
      throw serviceError("云环境未配置");
    }
    try {
      const res = await wx.cloud.callFunction({ name: "auth", data: { action: "profileGet" } });
      const r = res.result;
      if (!r || !r.ok) throw serviceError((r && r.message) || "档案读取失败");
      if (r.empty) return mockAllowed() ? mock.getAvatarProfile() : null;
      return Object.assign({ isExample: false }, r.profile);
    } catch (e) {
      if (mockAllowed()) return mock.getAvatarProfile();
      throw serviceError("档案读取失败");
    }
  },

  async saveAvatarProfile(data) {
    if (!cloudReady()) {
      if (mockAllowed()) return mock.saveAvatarProfile(data);
      throw serviceError("云环境未配置");
    }
    try {
      const res = await wx.cloud.callFunction({ name: "auth", data: Object.assign({ action: "profileSave" }, data) });
      const r = res.result;
      if (!r || !r.ok) throw serviceError((r && r.message) || "档案保存失败");
      return { ok: true, id: r.id };
    } catch (e) {
      if (mockAllowed()) return mock.saveAvatarProfile(data);
      throw serviceError("档案保存失败");
    }
  },

  getGarmentTemplates: mock.getGarmentTemplates,
  getGarmentLibrary: mock.getGarmentLibrary,
  getMyTemplates: mock.getMyTemplates,
  addToMyTemplates: mock.addToMyTemplates,
  getHomeTemplates: mock.getHomeTemplates,

  async uploadGarment(fileID, params) {
    // 上传衣物：云存储文件已由客户端上传，服务端落库并返回服务端生成的 garmentId
    if (!cloudReady()) {
      if (mockAllowed()) return mock.uploadGarment(fileID, params);
      throw serviceError("云环境未配置");
    }
    try {
      const res = await wx.cloud.callFunction({
        name: "uploadGarment",
        data: {
          action: "create",
          fileID,
          name: params.name,
          category: params.category
        }
      });
      const r = res.result;
      if (!r || !r.ok) throw new Error((r && r.error) || "上传失败");
      if (!r.pass) {
        return { ok: true, pass: false, reason: r.reason || "图片内容违规，请更换后重试" };
      }
      return {
        id: r.garmentId,
        image: fileID,
        name: r.name,
        category: r.category,
        status: "ok"
      };
    } catch (e) {
      if (mockAllowed()) return mock.uploadGarment(fileID, params);
      throw serviceError("上传失败");
    }
  },

  async submitTryon(params) {
    if (!cloudReady()) {
      if (mockAllowed()) return mock.submitTryon(params);
      throw serviceError("云环境未配置");
    }
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
      if (mockAllowed()) return mock.submitTryon(params);
      throw serviceError("试穿提交失败");
    }
  },

  async getTryonStatus(taskId) {
    if (!cloudReady()) {
      if (mockAllowed()) return mock.getTryonStatus(taskId);
      throw serviceError("云环境未配置");
    }
    try {
      const res = await db().collection("tryon_tasks").doc(taskId).get();
      return { taskId, status: res.data.status };
    } catch (e) {
      if (mockAllowed()) return mock.getTryonStatus(taskId);
      throw serviceError("状态查询失败");
    }
  },

  async getHistory() {
    if (!cloudReady()) {
      if (mockAllowed()) return mock.getHistory();
      throw serviceError("云环境未配置");
    }
    try {
      // 由云函数管理权限读取（云函数写入的记录无客户端 _openid 归属，直接读库会因权限读不到）
      const res = await wx.cloud.callFunction({ name: "aiTryon", data: { action: "history" } });
      const r = res.result;
      if (!r || !r.ok) throw serviceError((r && r.message) || "历史记录读取失败");
      if (!r.list || r.list.length === 0) return [];   // 确实无记录 → 空态，不再显示示例
      return r.list.map((d) => ({
        id: d.id,
        taskId: d.taskId || "",
        garmentName: d.garmentName,
        date: fmtDate(d.createdAt),
        image: d.image,
        aiTagged: true,
        videoUrl: d.videoUrl || ""
      }));
    } catch (e) {
      if (mockAllowed()) return mock.getHistory();
      throw serviceError("历史记录读取失败");
    }
  },

  async getFavorites() {
    if (!cloudReady()) {
      if (mockAllowed()) return mock.getFavorites();
      throw serviceError("云环境未配置");
    }
    try {
      const res = await wx.cloud.callFunction({ name: "aiTryon", data: { action: "favorites" } });
      const r = res.result;
      if (!r || !r.ok) throw serviceError((r && r.message) || "收藏读取失败");
      if (!r.list || r.list.length === 0) return [];
      return r.list.map((d) => ({
        id: d.id,
        garmentName: d.garmentName,
        date: fmtDate(d.createdAt),
        image: d.image,
        aiTagged: true,
        videoUrl: d.videoUrl || ""
      }));
    } catch (e) {
      if (mockAllowed()) return mock.getFavorites();
      throw serviceError("收藏读取失败");
    }
  },

  async deleteItems(kind, ids, opts) {
    if (!cloudReady()) {
      if (mockAllowed()) return mock.deleteItems(kind, ids);
      throw serviceError("云环境未配置");
    }
    // 已选穿搭引用暂存本地（云上数据范围待定）
    if (kind === "myTemplates") return mock.deleteItems(kind, ids);
    if (kind === "library") {
      // 衣物本体删除：服务端按 garments 记录联动清理（原图 + 四视图 1:1），客户端 fileID 不作为删除依据
      const res = await wx.cloud.callFunction({
        name: "uploadGarment",
        data: { action: "deleteGarment", garmentIds: ids }
      });
      const r = res.result;
      if (!r || !r.ok) throw new Error((r && r.error) || "云端清理失败");
      return mock.deleteItems(kind, ids);
    }
    try {
      if (kind === "history" || kind === "favorites") {
        // 云函数删除（云函数写入的记录无客户端 _openid 归属，直接删会因权限失败；同时删云存储文件）
        const res = await wx.cloud.callFunction({
          name: "aiTryon",
          data: { action: kind === "history" ? "deleteHistory" : "favoriteDelete", ids }
        });
        const r = res.result;
        if (!r || !r.ok) throw new Error((r && r.error) || "删除失败");
        return { ok: true, removed: r.removed };
      }
      if (kind === "templates") {
        const coll = db().collection("garments");
        for (const id of ids) {
          await coll.doc(id).remove();
        }
      }
      return { ok: true };
    } catch (e) {
      if (mockAllowed()) return mock.deleteItems(kind, ids);
      throw serviceError("删除失败");
    }
  },

  // 模板衣物（含用户保存的）暂走本地模拟，等用户确认云上数据范围后接入
  saveToTemplates: mock.saveToTemplates,
  recognizeGarment: mock.recognizeGarment,

  async getQuota() {
    if (!cloudReady()) {
      if (mockAllowed()) return mock.getQuota();
      throw serviceError("云环境未配置");
    }
    try {
      const res = await wx.cloud.callFunction({ name: "aiTryon", data: { action: "quota" } });
      const r = res.result;
      if (!r || !r.ok) throw serviceError((r && r.message) || "额度查询失败");
      return Object.assign({ isExample: false }, r.quota);
    } catch (e) {
      if (mockAllowed()) return mock.getQuota();
      throw serviceError("额度查询失败");
    }
  },

  async createAvatarViews(profile) {
    if (!cloudReady()) {
      if (mockAllowed()) return mock.createAvatarViews(profile);
      throw serviceError("云环境未配置");
    }
    try {
      // 客户端只传档案业务 ID，照片参考图由服务端从档案取 fileID 生成临时链接
      const res = await wx.cloud.callFunction({
        name: "createAvatarViews",
        data: { profileId: (profile && profile.id) || "" }
      });
      const r = res.result;
      if (!r.ok || isMockResult(r)) {
        if (mockAllowed()) {
          const m = await mock.createAvatarViews(profile);
          m.error = r.error || "云函数未返回真实 AI 结果";
          return m;
        }
        throw serviceError(r.error || "云函数未返回真实 AI 结果");
      }
      return r;
    } catch (e) {
      if (mockAllowed()) {
        const m = await mock.createAvatarViews(profile);
        m.error = (e && (e.errMsg || e.message)) || "云函数调用失败";
        return m;
      }
      throw serviceError("人物形象生成失败");
    }
  },

  async getAvatarViews() {
    if (!cloudReady()) {
      if (mockAllowed()) return mock.getAvatarViews();
      throw serviceError("云环境未配置");
    }
    try {
      // 由云函数管理权限读取最新三视图（不依赖客户端 _openid 权限匹配）
      const res = await wx.cloud.callFunction({ name: "createAvatarViews", data: { action: "get" } });
      const r = res.result;
      if (!r || !r.ok || r.empty || isMockResult(r.views)) {
        if (mockAllowed()) return mock.getAvatarViews();
        if (r && r.empty) return null; // 尚未生成人物形象：空态
        throw serviceError("人物形象读取失败");
      }
      return { status: r.status, views: r.views, isExample: false };
    } catch (e) {
      if (mockAllowed()) return mock.getAvatarViews();
      throw serviceError("人物形象读取失败");
    }
  },

  async ensureGarmentViews(garmentId, garmentName, garmentImage) {
    // 只提交业务 ID，衣物信息由服务端解析（内置模板白名单 / garments 集合）
    if (!cloudReady()) {
      if (mockAllowed()) return mock.ensureGarmentViews(garmentId, garmentName);
      throw serviceError("云环境未配置");
    }
    try {
      const res = await wx.cloud.callFunction({
        name: "ensureGarmentViews",
        data: { garmentId }
      });
      const r = res.result;
      if (!r.ok || isMockResult(r)) {
        if (mockAllowed()) return mock.ensureGarmentViews(garmentId, garmentName);
        throw serviceError(r.error || "四视图生成失败");
      }
      return r;
    } catch (e) {
      if (mockAllowed()) return mock.ensureGarmentViews(garmentId, garmentName);
      throw serviceError("四视图生成失败");
    }
  },

  async submitAiTryon(params) {
    if (!cloudReady()) {
      if (mockAllowed()) return mock.submitAiTryon(params);
      throw serviceError("云环境未配置");
    }
    try {
      const res = await wx.cloud.callFunction({ name: "aiTryon", data: Object.assign({ action: "submit" }, params) });
      const r = res.result;
      if (!r.ok || isMockResult(r)) {
        if (mockAllowed()) {
          const m = await mock.submitAiTryon(params);
          m.error = r.error || "AI 生成服务暂不可用，请稍后重试";
          return m;
        }
        throw serviceError(r.error || "AI 生成服务暂不可用，请稍后重试");
      }
      return r;
    } catch (e) {
      if (mockAllowed()) {
        const m = await mock.submitAiTryon(params);
        m.error = (e && (e.errMsg || e.message)) || "云函数调用失败";
        return m;
      }
      throw serviceError("试穿提交失败");
    }
  },

  async getAiTryonStatus(taskId) {
    if (!cloudReady()) {
      if (mockAllowed()) return mock.getAiTryonStatus(taskId);
      throw serviceError("云环境未配置");
    }
    try {
      const res = await wx.cloud.callFunction({ name: "aiTryon", data: { action: "status", taskId } });
      const r = res.result;
      if (!r.ok || isMockResult(r)) {
        if (mockAllowed()) return mock.getAiTryonStatus(taskId);
        throw serviceError("进度查询失败");
      }
      return r;
    } catch (e) {
      if (mockAllowed()) return mock.getAiTryonStatus(taskId);
      throw serviceError("进度查询失败");
    }
  },

  async saveAiResult(result) {
    if (!cloudReady()) {
      if (mockAllowed()) return mock.saveAiResult(result);
      throw serviceError("云环境未配置");
    }
    try {
      // 服务端按 taskId 解析结果记录，user_id + result_id 唯一且幂等
      const res = await wx.cloud.callFunction({
        name: "aiTryon",
        data: { action: "favoriteAdd", taskId: result.taskId || result.imageTaskId || "" }
      });
      const r = res.result;
      if (!r || !r.ok) throw new Error((r && r.message) || "收藏失败");
      return { ok: true, id: r.favoriteId, duplicate: r.duplicate };
    } catch (e) {
      if (mockAllowed()) return mock.saveAiResult(result);
      throw serviceError("收藏失败");
    }
  },

  // 账户信息暂走本地模拟（云上数据范围待用户确认后接入）
  getUserInfo: mock.getUserInfo,
  saveUserInfo: mock.saveUserInfo,
  logout: mock.logout,

  async saveResult(result) {
    if (!cloudReady()) {
      if (mockAllowed()) return mock.saveResult(result);
      throw serviceError("云环境未配置");
    }
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
      if (mockAllowed()) return mock.saveResult(result);
      throw serviceError("保存失败");
    }
  },

  async deleteUserData() {
    if (!cloudReady()) {
      if (mockAllowed()) return mock.deleteUserData();
      throw serviceError("云环境未配置");
    }
    try {
      // 账户删除走服务端作业（幂等、可重试、联动清理云存储文件）
      const res = await wx.cloud.callFunction({ name: "aiTryon", data: { action: "deleteAccount" } });
      const r = res.result;
      if (!r || !r.ok) throw new Error((r && r.message) || "删除失败");
      return { ok: true, jobId: r.jobId, status: r.status };
    } catch (e) {
      if (mockAllowed()) return mock.deleteUserData();
      throw serviceError("账户删除失败");
    }
  },
  isMockResult,
  isPublicHttpUrl
};

const { toast, navigate } = require("../../utils/interaction");
const api = require("../../utils/api");

Page({
  data: { garment: { name: "上传衣物", category: "上衣" }, garmentImage: "/assets/img/p11-garment.jpg" },
  onLoad() {
    const g = wx.getStorageSync("uploadedGarment");
    if (g && g.name) {
      this.setData({ garment: g });
    }
    // 优先展示用户实际上传的图（当前上传链路为模拟，image 可能为无效占位值，
    // 仅在是真实路径时使用，避免显示破图）
    const img = g && g.image;
    if (img && (img.indexOf("/assets/") === 0 || img.indexOf("http") === 0 || img.indexOf("cloud://") === 0 || img.indexOf("wxfile") === 0 || img.indexOf("tmp") === 0)) {
      this.setData({ garmentImage: img });
    }
  },
  onShow() {
    // 从进度页返回时重置防抖标记，允许重新提交
    this._submitting = false;
  },
  confirm() {
    if (this._submitting) return;
    this._submitting = true;
    const g = this.data.garment;
    const garmentId = (g && g.id) || "g-upload-" + Date.now();
    const avatarViewId = wx.getStorageSync("avatarViewId") || "av-current";
    api.ensureGarmentViews(garmentId, g.name, g.image).then(() => {
      return api.submitAiTryon({
        avatarViewId,
        garmentIds: [garmentId],
        garmentNames: [g.name]
      });
    }).then((res) => {
      wx.setStorageSync("aiTryonTask", { taskId: res.taskId, garmentName: g.name });
      this._submitting = false;
      navigate("/pages/tryon-progress/index");
    }).catch(() => {
      this._submitting = false;
      toast("提交失败，请重试");
    });
  }
});

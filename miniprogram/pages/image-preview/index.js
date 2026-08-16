const { toast, navigate } = require("../../utils/interaction");
const api = require("../../utils/api");

Page({
  data: { garment: { name: "上传衣物", category: "上衣" } },
  onLoad() {
    const g = wx.getStorageSync("uploadedGarment");
    if (g && g.name) {
      this.setData({ garment: g });
    }
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

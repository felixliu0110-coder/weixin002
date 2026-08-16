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
    api.submitTryon({
      avatarId: "avatar-demo",
      garmentId: "g-demo",
      pose: "front"
    }).then(() => {
      navigate("/pages/tryon-progress/index");
    });
  }
});

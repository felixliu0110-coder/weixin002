const { toast, navigate } = require("../../utils/interaction");
const api = require("../../utils/api");

Page({
  data: { category: "下装" },
  onCategory(e) {
    const category = e.detail.label;
    this.setData({ category });
    toast("品类已修正为：" + category);
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

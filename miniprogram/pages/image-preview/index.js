const { toast, navigate } = require("../../utils/interaction");
const api = require("../../utils/api");

Page({
  data: { category: "" },
  onLoad() {
    api.recognizeGarment().then((res) => {
      this.setData({ category: res.category });
      toast("已识别为「" + res.category + "」");
    });
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

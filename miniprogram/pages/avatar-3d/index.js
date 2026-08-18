const { toast, navigate } = require("../../utils/interaction");
const api = require("../../utils/api");

Page({
  data: {
    views: { composite: "" },
    isExample: false,
    profile: { heightCm: "--", weightKg: "--", waistCm: "--", legLengthCm: "--" }
  },
  onLoad() {
    api.getAvatarProfile().then((profile) => {
      if (profile) this.setData({ profile });
    }).catch(() => {});
    api.getAvatarViews().then((av) => {
      this.setData({ views: av.views || { composite: "" }, isExample: !!av.isExample });
    }).catch(() => this.setData({ views: { composite: "" }, isExample: true }));
  },
  onConfirm() {
    toast("AI 三视图已确认");
    navigate("/pages/home/index");
  },
  regenerate() {
    navigate("/pages/generate-progress/index");
  },
  edit() {
    navigate("/pages/basic-info/index");
  },
  goTryon() {
    navigate("/pages/tryon-select/index");
  }
});

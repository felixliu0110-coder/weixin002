const api = require("../../utils/api");
const { navigate } = require("../../utils/interaction");

Page({
  data: {
    views: { composite: "" },
    isExample: false,
    profile: { heightCm: "--", weightKg: "--", shoulderCm: "--", waistCm: "--", legLengthCm: "--" }
  },
  onLoad() {
    api.getAvatarProfile().then((profile) => {
      if (profile) this.setData({ profile });
    }).catch(() => {});
    api.getAvatarViews().then((av) => {
      this.setData({ views: av.views || { composite: "" }, isExample: !!av.isExample });
    }).catch(() => this.setData({ views: { composite: "" }, isExample: true }));
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

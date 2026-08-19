const api = require("../../utils/api");
const { navigate } = require("../../utils/interaction");

Page({
  data: {
    views: { composite: "" },
    isExample: false,
    profile: { heightCm: "--", weightKg: "--", shoulderCm: "--", waistCm: "--", legLengthCm: "--" }
  },

  loadData() {
    api.getAvatarProfile().then((profile) => {
      if (profile) this.setData({ profile });
    }).catch(() => {});

    api.getAvatarViews().then((av) => {
      this.setData({
        views: av && av.views ? av.views : { composite: "" },
        isExample: !!(av && av.isExample)
      });
    }).catch(() => {
      this.setData({ views: { composite: "" }, isExample: false });
    });
  },

  onShow() {
    this.loadData();
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

Component({
  properties: {
    title: { type: String, value: "" },
    showBack: { type: Boolean, value: false },
    backRoute: { type: String, value: "" },
    brand: { type: String, value: "" }
  },
  data: { statusBarHeight: 20, navHeight: 44 },
  lifetimes: {
    attached() {
      try {
        const info = wx.getWindowInfo();
        this.setData({ statusBarHeight: info.statusBarHeight || 20 });
      } catch (e) {
        this.setData({ statusBarHeight: 20 });
      }
    }
  },
  methods: {
    onBack() {
      if (this.data.backRoute) {
        const url = this.data.backRoute;
        const tabRoutes = ["/pages/home/index", "/pages/tryon-select/index", "/pages/history/index", "/pages/profile/index"];
        if (tabRoutes.includes(url)) {
          wx.switchTab({ url });
        } else {
          wx.navigateTo({ url });
        }
        return;
      }
      const pages = getCurrentPages();
      if (pages.length > 1) {
        wx.navigateBack();
      } else {
        wx.switchTab({ url: "/pages/home/index" });
      }
    }
  }
});

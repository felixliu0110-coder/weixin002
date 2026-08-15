Component({
  properties: {
    title: { type: String, value: "" },
    showBack: { type: Boolean, value: false }
  },
  data: { statusBarHeight: 20, navHeight: 44 },
  lifetimes: {
    attached() {
      const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      this.setData({ statusBarHeight: info.statusBarHeight || 20 });
    }
  },
  methods: {
    onBack() {
      const pages = getCurrentPages();
      if (pages.length > 1) {
        wx.navigateBack();
      } else {
        wx.switchTab({ url: "/pages/home/index" });
      }
    }
  }
});

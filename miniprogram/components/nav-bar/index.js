Component({
  properties: {
    title: { type: String, value: "" },
    showBack: { type: Boolean, value: false }
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
      const pages = getCurrentPages();
      if (pages.length > 1) {
        wx.navigateBack();
      } else {
        wx.switchTab({ url: "/pages/home/index" });
      }
    }
  }
});

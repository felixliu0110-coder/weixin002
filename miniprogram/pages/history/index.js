Page({
  data: {},
  onShow() {
    if (typeof this.getTabBar === "function" && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2, navMode: false, pill: false });
    }
  }
});

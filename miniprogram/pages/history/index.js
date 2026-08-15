const { navigate } = require("../../utils/interaction");
const api = require("../../utils/api");

Page({
  data: { records: [] },
  onLoad() {
    api.getHistory().then((records) => {
      this.setData({ records });
    });
  },
  onShow() {
    if (typeof this.getTabBar === "function" && this.getTabBar()) {
      // 原型 13 页 tabbar 高亮「我的」属原稿不一致，按 TabBar 结构高亮「收藏」（第 3 Tab）
      this.getTabBar().setData({ selected: 2, navMode: false, pill: false });
    }
  },
  openResult() {
    navigate("/pages/tryon-result/index");
  }
});

const { toast, navigate } = require("../../utils/interaction");
const api = require("../../utils/api");

Page({
  data: {
    keyword: "",
    templates: [],
    quota: { dailyFree: 3 }
  },
  onLoad() {
    api.getHomeTemplates().then((templates) => {
      this.setData({ templates });
    });
    api.getQuota().then((quota) => {
      this.setData({ quota });
    });
  },
  onShow() {
    if (typeof this.getTabBar === "function" && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0, navMode: false, pill: false });
    }
  },
  onSearchInput(e) { this.setData({ keyword: e.detail.value }); },
  onSearch() {
    const v = this.data.keyword.trim();
    toast(v ? "搜索「" + v + "」（原型演示）" : "请输入要搜索的衣物");
  },
  onMore() { toast("全部模板（原型占位）"); },
  goTryon() { navigate("/pages/tryon-select/index"); },
  goAvatar() { navigate("/pages/avatar-3d/index"); }
});

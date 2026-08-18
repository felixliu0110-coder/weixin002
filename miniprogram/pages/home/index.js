const { toast, navigate } = require("../../utils/interaction");
const api = require("../../utils/api");

Page({
  data: {
    statusBarHeight: 20,
    keyword: "",
    templates: [],
    quota: { dailyFree: 3, used: 0, remaining: 3 },
    avatarReady: false
  },
  onLoad() {
    try {
      const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      this.setData({ statusBarHeight: info.statusBarHeight || 20 });
    } catch (e) {
      this.setData({ statusBarHeight: 20 });
    }
    api.getHomeTemplates().then((templates) => {
      this.setData({ templates });
    });
    api.getQuota().then((quota) => {
      // 文案为「今日剩余」：必须展示 dailyFree - used，而非每日总额
      const remaining = Math.max(0, (quota.dailyFree || 0) - (quota.used || 0));
      this.setData({ quota: Object.assign({}, quota, { used: quota.used || 0, remaining }) });
    }).catch(() => {});
    // 数字人是否已真实创建（示例档案 = 未创建）
    api.getAvatarProfile().then((profile) => {
      this.setData({ avatarReady: !!(profile && !profile.isExample) });
    }).catch(() => this.setData({ avatarReady: false }));
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

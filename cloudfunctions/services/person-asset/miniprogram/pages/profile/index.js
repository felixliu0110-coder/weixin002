const { toast, navigate } = require("../../utils/interaction");
const api = require("../../utils/api");

Page({
  data: { quota: { dailyFree: 3, used: 0, remaining: 3 }, quotaPercent: 0, historyCount: 0, user: { nickname: "小云" }, avatarReady: false },

  loadAvatarState() {
    return api.getAvatarViews().then((av) => {
      const avatarReady = !!(
        av &&
        av.isExample === false &&
        av.views &&
        av.views.composite
      );
      this.setData({ avatarReady });
    }).catch(() => {
      this.setData({ avatarReady: false });
    });
  },

  onLoad() {
    api.getQuota().then((quota) => {
      const used = quota.used || 0;
      const dailyFree = quota.dailyFree || 0;
      const remaining = Math.max(0, dailyFree - used);
      const quotaPercent = dailyFree > 0 ? Math.min(100, Math.round(used / dailyFree * 100)) : 0;
      this.setData({ quota: Object.assign({}, quota, { used, remaining }), quotaPercent });
    }).catch(() => {});

    api.getUserInfo().then((user) => {
      this.setData({ user });
    });

    // 试穿记录数动态获取（原为硬编码 12）
    api.getHistory().then((records) => {
      this.setData({ historyCount: (records || []).length });
    }).catch(() => this.setData({ historyCount: 0 }));

    this.loadAvatarState();
  },

  onShow() {
    if (typeof this.getTabBar === "function" && this.getTabBar()) {
      this.getTabBar().setData({ selected: 3, navMode: false, pill: true });
    }

    this.loadAvatarState();
  },

  onSettings() { toast("设置（原型占位）"); },
  onQuota() { toast("每日免费 3 次 · 超出后付费解锁（V1 预留）"); },
  goAccount() { navigate("/pages/account/index"); },
  goAvatar() { navigate("/pages/avatar-3d/index"); },
  goHistory() { navigate("/pages/history/index"); },
  goPrivacy() { navigate("/pages/privacy-manage/index"); },
  goFeedback() { navigate("/pages/feedback-about/index"); }
});

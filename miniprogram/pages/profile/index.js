const { toast, navigate } = require("../../utils/interaction");
const api = require("../../utils/api");

Page({
  data: { quota: { dailyFree: 3 } },
  onLoad() {
    api.getQuota().then((quota) => {
      this.setData({ quota });
    });
  },
  onShow() {
    if (typeof this.getTabBar === "function" && this.getTabBar()) {
      this.getTabBar().setData({ selected: 3, navMode: false, pill: true });
    }
  },
  onSettings() { toast("设置（原型占位）"); },
  onQuota() { toast("每日免费 3 次 · 超出后付费解锁（V1 预留）"); },
  goAccount() { navigate("/pages/account/index"); },
  goAvatar() { navigate("/pages/avatar-3d/index"); },
  goHistory() { navigate("/pages/history/index"); },
  goPrivacy() { navigate("/pages/privacy-manage/index"); },
  goFeedback() { navigate("/pages/feedback-about/index"); }
});

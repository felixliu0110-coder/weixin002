const { toast, navigate } = require("../../utils/interaction");
const api = require("../../utils/api");

Page({
  data: { percent: 0, error: false },
  onLoad() {
    this.run();
  },
  async run() {
    try {
      const profile = await api.getAvatarProfile();
      const av = await api.createAvatarViews(profile);
      if (av && av.error) {
        this.setData({ error: true, errorMsg: av.error });
        return;
      }
      if (av && av.avatarViewId) {
        wx.setStorageSync("avatarViewId", av.avatarViewId);
      } else {
        wx.setStorageSync("avatarViewId", "av-current");
      }
      this.animateTo100();
    } catch (e) {
      this.setData({ error: true, errorMsg: (e && e.message) || "未知错误" });
    }
  },
  animateTo100() {
    this._startTimer = setTimeout(() => {
      this._frameTimer = setInterval(() => {
        const p = this.data.percent + 1;
        this.setData({ percent: p });
        if (p >= 100) {
          clearInterval(this._frameTimer);
          toast("数字人已生成");
          this._navTimer = setTimeout(() => navigate("/pages/avatar-3d/index"), 1200);
        }
      }, 10);
    }, 300);
  },
  retry() {
    this.setData({ percent: 0, error: false });
    this.run();
  },
  onUnload() {
    if (this._frameTimer) clearInterval(this._frameTimer);
    if (this._startTimer) clearTimeout(this._startTimer);
    if (this._navTimer) clearTimeout(this._navTimer);
  }
});

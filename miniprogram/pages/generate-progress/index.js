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
      this._started = true;
      this.animateTo100();
    } catch (e) {
      this.setData({ error: true, errorMsg: (e && e.message) || "未知错误" });
    }
  },
  animateTo100() {
    this.clearTimers();
    this._startTimer = setTimeout(() => {
      // 40ms/帧（25fps）：足够顺滑，且远低于 10ms 高频 setData 造成的通信拥堵
      this._frameTimer = setInterval(() => {
        const p = this.data.percent + 1;
        this.setData({ percent: p });
        if (p >= 100) {
          clearInterval(this._frameTimer);
          this._frameTimer = null;
          toast("人物三视图已生成");
          this._navTimer = setTimeout(() => navigate("/pages/avatar-3d/index"), 1200);
        }
      }, 40);
    }, 300);
  },
  retry() {
    this.setData({ percent: 0, error: false });
    this.run();
  },
  clearTimers() {
    if (this._frameTimer) { clearInterval(this._frameTimer); this._frameTimer = null; }
    if (this._startTimer) { clearTimeout(this._startTimer); this._startTimer = null; }
    if (this._navTimer) { clearTimeout(this._navTimer); this._navTimer = null; }
  },
  onHide() {
    // 页面不可见时停止动画与跳转，避免后台持续 setData / 意外跳转
    this.clearTimers();
  },
  onShow() {
    // 从后台/其他页面回来：若生成已成功且未走完动画，则续跑
    if (!this.data.error && this.data.percent < 100 && this._started) {
      this.animateTo100();
    }
  },
  onUnload() {
    this.clearTimers();
  }
});

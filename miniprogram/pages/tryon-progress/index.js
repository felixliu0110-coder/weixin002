const { toast, navigate } = require("../../utils/interaction");
const api = require("../../utils/api");

Page({
  data: { percent: 0, garmentName: "所选衣物", stageText: "生成衣物四视图" },
  onLoad() {
    const t = wx.getStorageSync("aiTryonTask") || {};
    this.taskId = t.taskId || "task-ai-mock";
    this.setData({ garmentName: t.garmentName || "所选衣物" });
    this.poll();
  },
  poll() {
    api.getAiTryonStatus(this.taskId).then((st) => {
      if (st.status === "failed") {
        this.setData({ stageText: "生成失败，请重试" });
        return;
      }
      this.setData({
        stageText: st.stage === "garment_views" ? "生成衣物四视图" : "生成 180° 转身视频"
      });
      if (st.status !== "success") {
        this._pollTimer = setTimeout(() => this.poll(), 900);
        return;
      }
      this.animateTo100(st);
    }).catch(() => {
      // 云函数/接口不可用时回退 mock 结果
      this.animateTo100({
        status: "success",
        tryonImage: "/assets/img/p07-result.jpg",
        tryonVideo: "/assets/video/mock-turn.mp4"
      });
    });
  },
  animateTo100(st) {
    this._startTimer = setTimeout(() => {
      this._frameTimer = setInterval(() => {
        const p = this.data.percent + 1;
        this.setData({ percent: p });
        if (p >= 100) {
          clearInterval(this._frameTimer);
          wx.setStorageSync("aiTryonResult", {
            tryonImage: st.tryonImage || "/assets/img/p07-result.jpg",
            tryonVideo: st.tryonVideo || "/assets/video/mock-turn.mp4",
            garmentName: this.data.garmentName
          });
          toast("生成完成 · AI 生成效果，仅供参考");
          this._navTimer = setTimeout(() => navigate("/pages/tryon-result/index"), 1400);
        }
      }, 40);
    }, 300);
  },
  onUnload() {
    if (this._frameTimer) clearInterval(this._frameTimer);
    if (this._startTimer) clearTimeout(this._startTimer);
    if (this._navTimer) clearTimeout(this._navTimer);
    if (this._pollTimer) clearTimeout(this._pollTimer);
  }
});

const { toast, navigate } = require("../../utils/interaction");
const api = require("../../utils/api");

const POLL_INTERVAL = 900;
const POLL_MAX = 200; // 约 3 分钟上限，超过进入失败态，避免无限轮询

Page({
  data: { percent: 0, garmentName: "所选衣物", stageText: "生成衣物四视图", error: false, errorMsg: "" },
  onLoad() {
    const t = wx.getStorageSync("aiTryonTask") || {};
    this.taskId = t.taskId || "task-ai-mock";
    this._pollCount = 0;
    this.setData({ garmentName: t.garmentName || "所选衣物" });
    this.poll();
  },
  poll() {
    api.getAiTryonStatus(this.taskId).then((st) => {
      if (st.status === "failed") {
        this.setData({ error: true, errorMsg: (st && st.error) || "生成失败，请重试" });
        return;
      }
      this.setData({
        stageText: st.stage === "garment_views" ? "生成衣物四视图" : "生成 180° 转身视频"
      });
      if (st.status !== "success") {
        this._pollCount += 1;
        if (this._pollCount >= POLL_MAX) {
          this.setData({ error: true, errorMsg: "生成超时，请稍后在试穿记录中查看结果" });
          return;
        }
        this._pollTimer = setTimeout(() => this.poll(), POLL_INTERVAL);
        return;
      }
      this.animateTo100(st);
    }).catch(() => {
      // 接口异常：展示失败态与重试入口，而不是伪造成功结果误导用户
      this.setData({ error: true, errorMsg: "网络异常，无法获取生成进度" });
    });
  },
  retry() {
    this.clearTimers();
    this._pollCount = 0;
    this.setData({ error: false, errorMsg: "", percent: 0, stageText: "生成衣物四视图" });
    this.poll();
  },
  backToSelect() {
    navigate("/pages/tryon-select/index");
  },
  animateTo100(st) {
    this.clearTimers();
    this._startTimer = setTimeout(() => {
      // 40ms/帧（25fps）：顺滑且避免高频 setData 通信拥堵
      this._frameTimer = setInterval(() => {
        const p = this.data.percent + 1;
        this.setData({ percent: p });
        if (p >= 100) {
          clearInterval(this._frameTimer);
          this._frameTimer = null;
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
  clearTimers() {
    if (this._frameTimer) { clearInterval(this._frameTimer); this._frameTimer = null; }
    if (this._startTimer) { clearTimeout(this._startTimer); this._startTimer = null; }
    if (this._navTimer) { clearTimeout(this._navTimer); this._navTimer = null; }
    if (this._pollTimer) { clearTimeout(this._pollTimer); this._pollTimer = null; }
  },
  onHide() {
    // 页面不可见时停止轮询/动画/跳转，避免后台持续请求与 setData
    this.clearTimers();
  },
  onShow() {
    // 回到页面：未完成则继续轮询进度
    if (!this.data.error && this.data.percent < 100) {
      this.poll();
    }
  },
  onUnload() {
    this.clearTimers();
  }
});

const { toast, navigate } = require("../../utils/interaction");
const api = require("../../utils/api");

const POLL_INTERVAL = 1000;
const POLL_MAX = 200;

Page({
  data: {
    result: { tryonImage: "/assets/img/p07-result.jpg", garmentName: "AI 试穿" },
    generating: false,
    percent: 0,
    stageText: "准备中",
    error: false,
    errorMsg: "",
    videoUrl: "",
    videoVisible: false
  },

  onLoad() {
    const r = wx.getStorageSync("aiTryonResult") || {};
    this.setData({
      result: Object.assign({ tryonImage: "/assets/img/p07-result.jpg", garmentName: "AI 试穿" }, r)
    });
    // 图片任务完成时通常已附带转身视频（缓存复用会返回同一任务）：
    // 已有视频直接进入完成态，不再走一遍无真实含义的假进度
    if (r.tryonVideo) {
      this.setData({ videoUrl: r.tryonVideo, stageText: "视频已就绪" });
    }
  },

  /* ---------- 生成视频 ---------- */
  startGenerate() {
    if (this.data.generating) return;
    this.setData({ generating: true, percent: 0, stageText: "提交视频任务", error: false, errorMsg: "" });

    const avatarViewId = wx.getStorageSync("avatarViewId") || "av-current";
    // 衣物信息优先取生成结果（aiTryonPending 在进度页提交成功后已被清除）
    const result = wx.getStorageSync("aiTryonResult") || {};
    const garments = result.garments || [];
    const imageTaskId = result.imageTaskId || "";
    let garmentIds = garments.map((g) => g.id);
    let garmentNames = garments.map((g) => g.name);
    if (!garmentIds.length) {
      const pending = wx.getStorageSync("aiTryonPending") || {};
      garmentIds = pending.garmentIds || [];
      garmentNames = pending.garmentNames || [];
    }
    if (!garmentIds.length) {
      this.setData({
        generating: false,
        error: true,
        errorMsg: "缺少衣物信息，请从生成结果页进入"
      });
      return;
    }
    if (!imageTaskId) {
      this.setData({
        generating: false,
        error: true,
        errorMsg: "缺少效果图任务，请从生成结果页进入"
      });
      return;
    }

    api.submitAiTryon({
      avatarViewId,
      garmentIds,
      garmentNames,
      mode: "video",
      imageTaskId
    })
      .then((res) => {
      // 云函数异常返回 { error } 而非抛异常：同样进入失败态，不静默回退
      if (res && res.error && !res.taskId) {
        this.setData({ generating: false, error: true, errorMsg: "生成失败：" + res.error });
        return;
      }
      this.taskId = res.taskId;
      this._pollCount = 0;
      this.setData({ stageText: "生成 180° 转身视频" });
      this.poll();
      }).catch((err) => {
      this.setData({
        generating: false,
        error: true,
        errorMsg: (err && err.message) || "提交失败，请检查网络后重试"
      });
      });
  },

  poll() {
    api.getAiTryonStatus(this.taskId).then((st) => {
      if (st.status === "failed") {
        this.setData({ error: true, errorMsg: (st && st.error) || "生成失败，请重试", generating: false });
        return;
      }
      this.setData({ stageText: "生成 180° 转身视频" });
      if (st.status !== "success") {
        this._pollCount += 1;
        if (this._pollCount >= POLL_MAX) {
          this.setData({ error: true, errorMsg: "生成超时，请稍后在试穿记录中查看结果", generating: false });
          return;
        }
        // 模拟进度：视频任务处理中
        const fakePercent = Math.min(95, Math.floor((this._pollCount / POLL_MAX) * 100));
        this.setData({ percent: fakePercent });
        this._pollTimer = setTimeout(() => this.poll(), POLL_INTERVAL);
        return;
      }
      this.animateTo100(st);
    }).catch(() => {
      this.setData({ error: true, errorMsg: "网络异常，无法获取生成进度", generating: false });
    });
  },

  animateTo100(st) {
    this.clearTimers();
    this._startTimer = setTimeout(() => {
      this._frameTimer = setInterval(() => {
        const p = this.data.percent + 2;
        this.setData({ percent: p });
        if (p >= 100) {
          clearInterval(this._frameTimer);
          this._frameTimer = null;
          const videoUrl = st.tryonVideo || "";
          this.setData({
            generating: false,
            videoUrl,
            stageText: videoUrl ? "生成完成" : "视频未生成"
          });
          if (videoUrl) {
            // 回写结果缓存，下次进入直接展示完成态
            const r = wx.getStorageSync("aiTryonResult") || {};
            r.tryonVideo = videoUrl;
            wx.setStorageSync("aiTryonResult", r);
            toast("视频生成完成 · AI 生成效果，仅供参考");
          } else {
            this.setData({ error: true, errorMsg: "本次任务未生成视频，请重试" });
          }
        }
      }, 40);
    }, 300);
  },

  /* ---------- 重试 ---------- */
  retry() {
    this.setData({ error: false, errorMsg: "", percent: 0, stageText: "准备中", generating: false, videoUrl: "" });
  },

  /* ---------- 返回结果页 ---------- */
  backToResult() {
    // 本页由结果页 navigateTo 进入：直接返回，避免页面栈叠加
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack();
      return;
    }
    navigate("/pages/tryon-result/index");
  },

  /* ---------- 播放视频 ---------- */
  playVideo() {
    if (!this.data.videoUrl) {
      toast("视频尚未生成");
      return;
    }
    this.setData({ videoVisible: true });
  },
  closeVideo() {
    this.setData({ videoVisible: false });
  },

  /* ---------- 生命周期 ---------- */
  clearTimers() {
    if (this._frameTimer) { clearInterval(this._frameTimer); this._frameTimer = null; }
    if (this._startTimer) { clearTimeout(this._startTimer); this._startTimer = null; }
    if (this._pollTimer) { clearTimeout(this._pollTimer); this._pollTimer = null; }
  },

  onHide() { this.clearTimers(); },
  onUnload() { this.clearTimers(); }
});

const { toast, navigate } = require("../../utils/interaction");
const api = require("../../utils/api");
const { nextPollInterval, POLL_MAX_MS } = require("../../utils/poll");

Page({
  data: {
    percent: 0,
    garmentName: "所选衣物",
    stageText: "提交任务中",
    error: false,
    errorMsg: "",
    submitting: true // 提交阶段状态：先展示"提交中"，不阻塞上一页
  },
  onLoad() {
    const pending = wx.getStorageSync("aiTryonPending") || {};
    this.setData({ garmentName: pending.displayName || "所选衣物" });

    // 没有待提交任务：直接读取已有 taskId 开始轮询（从结果页返回等场景）
    const existing = wx.getStorageSync("aiTryonTask") || {};
    if (!pending.garmentIds && existing.taskId) {
      this.taskId = existing.taskId;
      this._pollCount = 0;
      this._pollStartedAt = Date.now();
      this.setData({ submitting: false, stageText: "生成衣物四视图" });
      this.poll();
      return;
    }

    // 正常流程：先提交任务，再轮询进度（提交在进度页内完成，点击"生成穿搭"立即跳转）
    this.submitTask(pending);
  },

  submitTask(pending) {
    const avatarViewId = wx.getStorageSync("avatarViewId") || "av-current";
    const items = (pending.garmentIds || []).map((id, i) => ({
      id,
      name: (pending.garmentNames || [])[i],
      image: (pending.garmentImages || [])[i]
    }));

    // 先预处理所有衣物的四视图
    Promise.all(items.map((g) => api.ensureGarmentViews(g.id, g.name, g.image)))
      .then(() => {
        return api.submitAiTryon({
          avatarViewId,
          garmentIds: pending.garmentIds,
          garmentNames: pending.garmentNames
        });
      })
      .then((res) => {
        // 云函数异常时返回 { ok:false, error } 而非抛异常：同样进入失败态
        if (res && res.error && !res.taskId) {
          this.setData({
            submitting: false,
            error: true,
            errorMsg: "生成失败：" + res.error
          });
          return;
        }
        // 提交成功：保存 taskId，清除 pending，进入轮询
        wx.setStorageSync("aiTryonTask", {
          taskId: res.taskId,
          garmentName: pending.displayName || "所选衣物"
        });
        wx.removeStorageSync("aiTryonPending");
        this.taskId = res.taskId;
        this._pollCount = 0;
        this._pollStartedAt = Date.now();
        this.setData({ submitting: false, stageText: "生成衣物四视图" });
        this.poll();
      })
      .catch((err) => {
        // 提交失败：展示失败态，允许重试
        this.setData({
          submitting: false,
          error: true,
          errorMsg: (err && err.message) || "提交失败，请检查网络后重试"
        });
      });
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
        if (Date.now() - this._pollStartedAt > POLL_MAX_MS) {
          this.setData({ error: true, errorMsg: "生成仍在后台进行，可稍后在试穿记录查看" });
          return;
        }
        this._pollCount += 1;
        this._pollTimer = setTimeout(() => this.poll(), nextPollInterval(this._pollCount));
        return;
      }
      this.animateTo100(st);
    }).catch(() => {
      // 接口异常：展示失败态与重试入口，而不是伪造成功结果误导用户
      this.setData({ error: true, errorMsg: "网络异常，无法获取生成进度" });
    });
  },

  retry() {
    // 重试：读取 pending 重新提交，或继续轮询已有 task
    const pending = wx.getStorageSync("aiTryonPending");
    if (pending && pending.garmentIds) {
      this.setData({ error: false, errorMsg: "", percent: 0, stageText: "提交任务中", submitting: true });
      this.submitTask(pending);
      return;
    }
    // 没有 pending 但有 taskId：重新轮询
    if (this.taskId) {
      this.clearTimers();
      this._pollCount = 0;
      this._pollStartedAt = Date.now();
      this.setData({ error: false, errorMsg: "", percent: 0, stageText: "生成衣物四视图", submitting: false });
      this.poll();
    }
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
    if (!this.data.error && this.data.percent < 100 && !this.data.submitting) {
      this.poll();
    }
  },

  onUnload() {
    this.clearTimers();
  }
});

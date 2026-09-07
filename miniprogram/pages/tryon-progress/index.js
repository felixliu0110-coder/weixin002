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
    errorHint: "", // 用户可见的友好提示（技术错误码只进 console，不暴露给用户）
    submitting: true // 提交阶段状态：先展示"提交中"，不阻塞上一页
  },
  onLoad() {
    const pending = wx.getStorageSync("aiTryonPending") || {};
    this.setData({ garmentName: pending.displayName || "所选衣物" });

    // 没有待提交任务：直接读取已有 taskId 开始轮询（从结果页返回等场景）
    const existing = wx.getStorageSync("aiTryonTask") || {};
    if (!pending.garmentIds && existing.taskId) {
      // 失败任务只保留历史 taskId；如果存在 retryPayload，直接显示失败态并允许创建新任务。
      if (existing.status === "failed" && existing.retryPayload) {
        this._pending = existing.retryPayload;
        this.setData({
          submitting: false,
          error: true,
          errorMsg: existing.lastError || "",
          errorHint: "这次没有生成成功，可以重新尝试。"
        });
        return;
      }
      this.taskId = existing.taskId;
      this._pollCount = 0;
      this._pollStartedAt = Date.now();
      this.setData({ submitting: false, stageText: "合成试穿效果图" });
      this.poll();
      return;
    }

    // V1：直接使用当前人物档案提交图片试穿。
    this.submitTask(pending);
  },

  submitTask(pending) {
    // V1 首测前先做无成本运行时检查，避免误把旧 V2/legacy 代码当成当前运行时。
    this._pending = pending;
    api.getTryonDiagnostics().then((diag) => {
      if (diag.runtime !== "v1" || diag.provider !== "aitryon" || diag.model !== "aitryon" || !diag.engineLoaded || !diag.dashscopeConfigured || diag.agnesConfigured || diag.configurationConflict || diag.mockFallback || diag.engineFallback || diag.videoEnabled) {
        throw new Error("试穿服务当前不是 V1 aitryon 运行时，请先完成服务部署/配置检查。");
      }
      return api.getAvatarProfile();
    }).then((profile) => {
      const avatarProfileId = profile && profile.id;
      if (!avatarProfileId) {
        this.setData({
          submitting: false,
          error: true,
          errorMsg: "缺少人物档案，请先完善人物资料。",
          errorHint: "请返回人物资料页完成创建后再试。"
        });
        return;
      }
      this._pending.avatarProfileId = avatarProfileId;
      // 图片任务直接提交：云函数使用 avatarProfileId → Person Asset → Provider。
      return api.submitAiTryon({
        avatarProfileId,
        garmentIds: pending.garmentIds,
        garmentNames: pending.garmentNames,
        garmentImages: pending.garmentImages || []
      });
    })
      .then((res) => {
        // 云函数异常时返回 { ok:false, error } 而非抛异常：同样进入失败态
        if (res && res.error && !res.taskId) {
          console.warn("[tryon-progress] submit error:", res.error);
          this.setData({
            submitting: false,
            error: true,
            errorMsg: res.error,
            errorHint: "这次没有生成成功，可以重新尝试。"
          });
          return;
        }
        // 提交成功：保存 taskId，清除 pending，进入轮询
        // 保存“可重新提交”的完整上下文。失败任务不能作为 retry 的提交源，
        // 否则 retry 会继续轮询已经 FAILED / PROVIDER_TASK_NOT_FOUND 的旧 taskId。
        const retryPayload = {
          garmentId: (pending.garmentIds && pending.garmentIds[0]) || pending.garmentId || "",
          garmentIds: (pending.garmentIds || []).slice(0, 1),
          garmentNames: (pending.garmentNames || []).slice(0, 1),
          garmentImages: (pending.garmentImages || []).slice(0, 1),
          garmentCategories: (pending.garmentCategories || []).slice(0, 1),
          displayName: pending.displayName || "所选衣物",
          avatarProfileId: pending.avatarProfileId || this._pending.avatarProfileId || ""
        };
        wx.setStorageSync("aiTryonTask", {
          taskId: res.taskId,
          status: res.status || "processing",
          garmentName: pending.displayName || "所选衣物",
          retryPayload
        });
        wx.removeStorageSync("aiTryonPending");
        this.taskId = res.taskId;
        this._pollCount = 0;
        this._pollStartedAt = Date.now();
        this.setData({ submitting: false, stageText: "合成试穿效果图" });
        // 图片任务提交即出图完成：无需轮询，直接进入完成动画
        if (res.status === "success" && res.tryonImage) {
          this.animateTo100(res);
          return;
        }
        this.poll();
      })
      .catch((err) => {
        // 提交失败：展示失败态，允许重试（技术细节只记录，不展示给用户）
        console.warn("[tryon-progress] submit exception:", err && err.message);
        const storedTask = wx.getStorageSync("aiTryonTask") || {};
        if (storedTask.taskId) {
          wx.setStorageSync("aiTryonTask", Object.assign({}, storedTask, { status: "failed" }));
        }
        this.setData({
          submitting: false,
          error: true,
          errorMsg: (err && err.message) || "",
          errorHint: "这次没有生成成功，可以重新尝试。"
        });
      });
  },

  poll() {
    api.getAiTryonStatus(this.taskId).then((st) => {
      if (st.status === "failed") {
        console.warn("[tryon-progress] task failed:", st && st.error);
        // 记录终态；不要让后续重新进入页面时误把这个 taskId 当成仍可轮询的任务。
        const storedTask = wx.getStorageSync("aiTryonTask") || {};
        wx.setStorageSync("aiTryonTask", Object.assign({}, storedTask, { status: "failed", lastError: (st && (st.error || st.errorMessage)) || "" }));
        this.setData({ error: true, errorMsg: (st && st.error) || "", errorHint: "这次没有生成成功，可以重新尝试。" });
        return;
      }
      const providerStatusText = {
        PENDING: '排队中',
        'PRE-PROCESSING': '准备人物与衣物',
        RUNNING: 'AI 正在生成',
        'POST-PROCESSING': '正在整理结果'
      };
      this.setData({
        stageText: providerStatusText[st.providerStatus] || 'AI 正在生成'
      });
      if (st.status !== "success") {
        if (Date.now() - this._pollStartedAt > POLL_MAX_MS) {
          this.setData({ error: true, errorMsg: "", errorHint: "生成仍在后台进行，可稍后在试穿记录查看结果。" });
          return;
        }
        this._pollCount += 1;
        this._pollTimer = setTimeout(() => this.poll(), nextPollInterval(this._pollCount));
        return;
      }
      this.animateTo100(st);
    }).catch(() => {
      // 接口异常：展示失败态与重试入口，而不是伪造成功结果误导用户
      this.setData({ error: true, errorMsg: "", errorHint: "网络不太稳定，请再试一次。" });
    });
  },

  retry() {
    // V20：失败后的“重新生成”必须创建全新的 Provider 任务。
    // 旧 taskId 即使仍保存在本地缓存，也只能用于历史追踪，不能再次轮询/提交。
    const pending = wx.getStorageSync("aiTryonPending") || {};
    const storedTask = wx.getStorageSync("aiTryonTask") || {};
    const retryPayload = storedTask.retryPayload || null;
    const resubmitPayload = (pending.garmentIds && pending.garmentIds.length) ? pending : retryPayload;

    if (resubmitPayload && resubmitPayload.garmentIds && resubmitPayload.garmentIds.length === 1) {
      const freshPending = Object.assign({}, resubmitPayload, {
        garmentId: resubmitPayload.garmentId || resubmitPayload.garmentIds[0],
        avatarProfileId: resubmitPayload.avatarProfileId || (this._pending && this._pending.avatarProfileId) || ""
      });
      // 清掉旧 task 的“处理中”语义，避免 submit 时被任何本地状态误导。
      this.clearTimers();
      this.setData({ error: false, errorMsg: "", errorHint: "", percent: 0, stageText: "提交任务中", submitting: true });
      this.submitTask(freshPending);
      return;
    }

    // V20：即使本地没有 retryPayload，也可以让云函数依据旧失败 task 恢复原始人物/衣物上下文，创建全新 Provider 任务。
    if (this.taskId && storedTask.status === "failed") {
      this.clearTimers();
      this.setData({ error: false, errorMsg: "", errorHint: "", percent: 0, stageText: "提交任务中", submitting: true });
      api.retryAiTryon(this.taskId).then((res) => {
        if (!res || !res.taskId) throw new Error("重新生成未返回新任务");
        const retryPayload = storedTask.retryPayload || this._pending || {};
        wx.setStorageSync("aiTryonTask", {
          taskId: res.taskId,
          status: res.status || "processing",
          garmentName: retryPayload.displayName || this.data.garmentName || "所选衣物",
          retryPayload
        });
        this.taskId = res.taskId;
        this._pollCount = 0;
        this._pollStartedAt = Date.now();
        this.setData({ submitting: false, stageText: "合成试穿效果图" });
        this.poll();
      }).catch((err) => {
        this.setData({ submitting: false, error: true, errorMsg: (err && err.message) || "", errorHint: "这次没有生成成功，可以重新尝试。" });
      });
      return;
    }

    // 没有足够上下文时才允许继续轮询现有 task。
    if (this.taskId && storedTask.status !== "failed") {
      this.clearTimers();
      this._pollCount = 0;
      this._pollStartedAt = Date.now();
      this.setData({ error: false, errorMsg: "", errorHint: "", percent: 0, stageText: "合成试穿效果图", submitting: false });
      this.poll();
    } else {
      this.setData({ error: true, errorMsg: "", errorHint: "缺少本次试穿信息，请返回重新选择衣物。" });
    }
  },

  backToSelect() {
    navigate("/pages/tryon-select/index");
  },

  animateTo100(st) {
    this.clearTimers();
    // submitTask 挂载的 pending：用于构造单件衣物清单（供结果页保存模板按衣物归档）
    const pending = this._pending || {};
    // 无 pending 重入（仅 taskId 轮询）时保留已存的衣物明细，避免覆盖丢失
    const prevResult = wx.getStorageSync("aiTryonResult") || {};
    // 禁止 success + 无真实图片进入成功结果页
    const realImage = st.tryonImage || st.tryonImageUrl || "";
    if (st.status === "success" && !realImage) {
      this.setData({
        error: true,
        errorMsg: "",
        errorHint: "生成结果暂时不可用，请稍后重试。"
      });
      return;
    }
    this._startTimer = setTimeout(() => {
      // 40ms/帧（25fps）：顺滑且避免高频 setData 通信拥堵
      this._frameTimer = setInterval(() => {
        const p = this.data.percent + 1;
        this.setData({ percent: p });
        if (p >= 100) {
          clearInterval(this._frameTimer);
          this._frameTimer = null;
          wx.setStorageSync("aiTryonResult", {
            resultId: st.resultId || "",
            taskId: st.taskId || "",
            garmentId: (pending.garmentIds && pending.garmentIds[0]) || "",
            personAssetId: st.personAssetId || pending.personAssetId || "",
            avatarViewId: "",
            avatarProfileId: pending.avatarProfileId || "",
            tryonImage: realImage,
            tryonImageUrl: st.tryonImageUrl || "",
            imageTaskId: st.taskId || "",
            tryonVideo: st.tryonVideo || "",
            garmentName: this.data.garmentName,
            garments: pending.garmentIds ? pending.garmentIds.map((id, i) => ({
              id,
              name: pending.garmentNames[i],
              image: pending.garmentImages[i],
              category: pending.garmentCategories[i] || "上衣"
            })) : (prevResult.garments || [])
          });
          toast("生成完成 · 效果仅供参考");
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

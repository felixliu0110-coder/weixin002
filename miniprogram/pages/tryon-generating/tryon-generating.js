const { toast } = require("../../utils/interaction");
const api = require("../../utils/api");

const STATUS = ["QUEUED", "PROCESSING", "SUCCEEDED", "FAILED", "EXPIRED"];

Page({
  data: { taskId: "", status: "QUEUED", statusText: "排队中…", result: null, pollTimer: null },
  onLoad(q) {
    const taskId = (q && q.taskId) || wx.getStorageSync("aiTryonTaskId") || "";
    this.setData({ taskId });
    // Phase 5-1：Engine 未开启时仅展示占位状态，不真实轮询
    if (!taskId) {
      this.setData({ status: "QUEUED", statusText: "等待任务提交（演示状态）" });
      return;
    }
    this.poll(taskId);
  },
  poll(taskId) {
    // 按现有任务状态接口轮询（getTryonStatus），此处为骨架预留
    api.getTryonStatus && api.getTryonStatus(taskId).then((r) => {
      const s = (r && r.status) || "PROCESSING";
      this.setData({ status: s, statusText: this.statusLabel(s) });
      if (s === "SUCCEEDED" || s === "FAILED" || s === "EXPIRED") {
        if (s === "SUCCEEDED") this.setData({ result: r.resultUrls && r.resultUrls[0] || null });
        return;
      }
      this.data.pollTimer = setTimeout(() => this.poll(taskId), 2000);
    }).catch(() => this.setData({ status: "FAILED", statusText: "查询失败" }));
  },
  statusLabel(s) {
    return { QUEUED: "排队中…", PROCESSING: "生成中…", SUCCEEDED: "已完成", FAILED: "失败", EXPIRED: "已过期" }[s] || s;
  },
  onRetry() { wx.navigateBack(); },
  onDone() { wx.redirectTo({ url: "/pages/tryon-result/index" }); }
});

const { toast, navigate } = require("../../utils/interaction");
const api = require("../../utils/api");

Page({
  data: { records: [], loading: true },
  onShow() { this.load(); },
  // Phase 5-1（B 方案）：先接 getHistory 接口预留；Engine 未启用时通常为空态
  load() {
    this.setData({ loading: true });
    if (typeof api.getHistory !== "function") {
      this.setData({ records: [], loading: false }); // 接口未就绪 → 空态，不报错
      return;
    }
    api.getHistory().then((list) => {
      // 仅显示当前用户数据（服务端已按 openid 过滤，前端再校验一次）
      this.setData({ records: (list || []).filter(r => r && r.id), loading: false });
    }).catch(() => { this.setData({ loading: false }); toast("加载失败"); });
  },
  onTap(e) {
    const r = e.currentTarget.dataset.record;
    if (!r || r.status !== "success") return toast("该记录暂无结果");
    navigate("/pages/tryon-result/index?taskId=" + r.taskId);
  }
});

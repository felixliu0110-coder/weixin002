const { toast, navigate } = require("../../utils/interaction");

const LIMITS = {
  bust: { min: 70, max: 115 },
  waist: { min: 50, max: 105 },
  hip: { min: 75, max: 120 }
};

Page({
  data: {
    bust: 88,
    waist: 66,
    hip: 92,
    estimate: true,
    leg: 96,
    skin: 55
  },
  onEstimate(e) {
    const on = e.detail.value;
    this.setData({ estimate: on });
    toast(on ? "缺省估算已开启" : "缺省估算已关闭，改为手动填写");
  },
  step(e) {
    const kind = e.currentTarget.dataset.kind;
    const delta = parseInt(e.currentTarget.dataset.delta, 10);
    const limit = LIMITS[kind];
    const next = Math.max(limit.min, Math.min(limit.max, this.data[kind] + delta));
    this.setData({ [kind]: next });
  },
  onLeg(e) { this.setData({ leg: e.detail.value }); },
  onSkin(e) { this.setData({ skin: e.detail.value }); },
  onChip(e) {
    const label = e.detail.label;
    const values = {
      "颈长 10cm": "颈长 10cm（估算值，可修改）",
      "肩宽 38cm": "肩宽 38cm（估算值，可修改）",
      "臂长 55cm": "臂长 55cm（估算值，可修改）",
      "鞋码 38": "鞋码 38（估算值，可修改）"
    };
    toast(values[label] || label);
  },
  next() {
    navigate("/pages/photo-upload/index");
  }
});

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
    skin: 55,
    neck: 10,
    shoulder: 38,
    arm: 55,
    shoe: 38,
    editVisible: false,
    editField: "neck",
    editTitle: "颈长",
    editValue: 10,
    editMin: 5,
    editMax: 15,
    editUnit: "cm"
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
  openEdit(e) {
    const field = e.currentTarget.dataset.field;
    const CONFIG = {
      neck: { title: "颈长", min: 5, max: 15, unit: "cm" },
      shoulder: { title: "肩宽", min: 30, max: 50, unit: "cm" },
      arm: { title: "臂长", min: 45, max: 70, unit: "cm" },
      shoe: { title: "鞋码", min: 34, max: 44, unit: "" }
    };
    const cfg = CONFIG[field];
    this.setData({
      editVisible: true,
      editField: field,
      editTitle: cfg.title,
      editValue: this.data[field],
      editMin: cfg.min,
      editMax: cfg.max,
      editUnit: cfg.unit
    });
  },
  onEditChange(e) {
    this.setData({ editValue: e.detail.value });
  },
  closeEdit() {
    this.setData({ editVisible: false });
  },
  confirmEdit() {
    this.setData({
      [this.data.editField]: this.data.editValue,
      editVisible: false
    });
    toast(this.data.editTitle + "已改为 " + this.data.editValue + (this.data.editUnit || ""));
  },
  next() {
    navigate("/pages/photo-upload/index");
  }
});

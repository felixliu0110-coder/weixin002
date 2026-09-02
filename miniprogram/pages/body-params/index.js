const { toast, navigate } = require("../../utils/interaction");
const api = require("../../utils/api");

Page({
  data: {
    // Phase 5-1：estimate 默认关闭；估算值仅本地 UI 占位，绝不写入真实 Body Profile
    estimate: false,
    leg: null,
    skin: null,
    neck: null,
    shoulder: null,
    arm: null,
    shoe: null,
    editVisible: false,
    editField: "neck",
    editTitle: "颈长",
    editValue: 10,
    editMin: 5,
    editMax: 15,
    editUnit: "cm"
  },
  onLoad() {
    // 回填已保存档案：编辑场景必须看到当前值而非默认值
    // （三围已在步骤1维护，此处不再回填/保存，避免两页写同一字段）
    api.getAvatarProfile().then((p) => {
      if (!p || p.isExample) return;
      const SKIN_TO_SLIDER = { light: 10, natural: 38, tan: 63, deep: 88 };
      const patch = {};
      if (p.legLengthCm) patch.leg = p.legLengthCm;
      if (p.neckLengthCm) patch.neck = p.neckLengthCm;
      if (p.shoulderCm) patch.shoulder = p.shoulderCm;
      if (p.armLengthCm) patch.arm = p.armLengthCm;
      if (p.shoeSize) patch.shoe = p.shoeSize;
      if (typeof p.estimate === "boolean") patch.estimate = p.estimate;
      if (SKIN_TO_SLIDER[p.skinTone]) patch.skin = SKIN_TO_SLIDER[p.skinTone];
      if (Object.keys(patch).length > 0) this.setData(patch);
    }).catch(() => {});
  },
  onEstimate(e) {
    const on = e.detail.value;
    this.setData({ estimate: on });
    toast(on ? "缺省估算已开启" : "缺省估算已关闭，改为手动填写");
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
    // Phase 5-1：仅在用户确实填写过真实测量值（非 null）时才持久化；
    // estimate 开启时滑块只是预览，绝不冒充真实身体数据写入档案。
    const patch = {};
    const d = this.data;
    if (d.leg != null) patch.legLengthCm = d.leg;
    if (d.neck != null) patch.neckLengthCm = d.neck;
    if (d.shoulder != null) patch.shoulderCm = d.shoulder;
    if (d.arm != null) patch.armLengthCm = d.arm;
    if (d.shoe != null) patch.shoeSize = d.shoe;
    const hasReal = Object.keys(patch).length > 0;
    const done = () => navigate("/pages/photo-upload/index");
    if (!hasReal) { done(); return; }
    api.saveAvatarProfile(patch).then(done).catch(() => toast("保存失败，请重试"));
  }
});

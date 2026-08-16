const { toast, navigate } = require("../../utils/interaction");
const api = require("../../utils/api");

Page({
  data: {
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
    });
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
    // slider 0-100 → 数据模型约定的肤色字符串（mock/云档案 skinTone 均为字符串）
    const s = this.data.skin;
    const skinTone = s >= 76 ? "deep" : s >= 51 ? "tan" : s >= 26 ? "natural" : "light";
    api.saveAvatarProfile({
      legLengthCm: this.data.leg,
      neckLengthCm: this.data.neck,
      shoulderCm: this.data.shoulder,
      armLengthCm: this.data.arm,
      shoeSize: this.data.shoe,
      skinTone,
      estimate: this.data.estimate
    }).then(() => {
      navigate("/pages/photo-upload/index");
    }).catch(() => {
      toast("保存失败，请重试");
    });
  }
});

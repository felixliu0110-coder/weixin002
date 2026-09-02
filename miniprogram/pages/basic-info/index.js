const { toast, navigate } = require("../../utils/interaction");
const api = require("../../utils/api");

// 三围步进上下限（与估算区间一致，防止越界提交）
const LIMITS = {
  bust: { min: 70, max: 115 },
  waist: { min: 50, max: 105 },
  hip: { min: 75, max: 120 }
};

Page({
  data: {
    genderOptions: [
      { label: "女性", value: "female" },
      { label: "男性", value: "male" }
    ],
    // Phase 5-1：禁止默认身体数值；无用户数据时保持 null，由 UI 提示完善资料
    gender: "",
    height: null,
    weight: null,
    bust: null,
    waist: null,
    hip: null
  },
  onLoad() {
    // 回填已保存档案：编辑场景必须看到当前值而非默认值
    api.getAvatarProfile().then((p) => {
      if (!p || p.isExample) return;
      // 精确回填：仅用已保存的真实值（??），falsey 值（含 0）不再回退到默认值
      this.setData({
        gender: p.gender ?? this.data.gender,
        height: p.heightCm != null ? p.heightCm : this.data.height,
        weight: p.weightKg != null ? p.weightKg : this.data.weight,
        bust: p.bustCm != null ? p.bustCm : this.data.bust,
        waist: p.waistCm != null ? p.waistCm : this.data.waist,
        hip: p.hipCm != null ? p.hipCm : this.data.hip
      });
    }).catch(() => {});
  },
  onGender(e) {
    const gender = e.detail.value;
    this.setData({ gender });
    toast("性别已设为「" + (gender === "female" ? "女" : "男") + "」");
  },
  onHeight(e) { this.setData({ height: e.detail.value }); },
  onWeight(e) { this.setData({ weight: e.detail.value }); },
  step(e) {
    const kind = e.currentTarget.dataset.kind;
    const delta = parseInt(e.currentTarget.dataset.delta, 10);
    const limit = LIMITS[kind];
    if (!limit) return; // 未配置上下限的字段不参与步进（防扩展时崩溃）
    const next = Math.max(limit.min, Math.min(limit.max, this.data[kind] + delta));
    this.setData({ [kind]: next });
  },
  next() {
    // 先保存成功再跳转：云模式下避免下一页读到旧档案（保存与跳转竞态）
    api.saveAvatarProfile({
      gender: this.data.gender,
      heightCm: this.data.height,
      weightKg: this.data.weight,
      bustCm: this.data.bust,
      waistCm: this.data.waist,
      hipCm: this.data.hip
    }).then(() => {
      navigate("/pages/body-params/index");
    }).catch(() => {
      toast("保存失败，请重试");
    });
  }
});

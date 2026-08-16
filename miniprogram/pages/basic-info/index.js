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
    gender: "female",
    height: 165,
    weight: 50,
    bust: 88,
    waist: 66,
    hip: 92
  },
  onLoad() {
    // 回填已保存档案：编辑场景必须看到当前值而非默认值
    api.getAvatarProfile().then((p) => {
      if (!p || p.isExample) return;
      this.setData({
        gender: p.gender || this.data.gender,
        height: p.heightCm || this.data.height,
        weight: p.weightKg || this.data.weight,
        bust: p.bustCm || this.data.bust,
        waist: p.waistCm || this.data.waist,
        hip: p.hipCm || this.data.hip
      });
    });
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

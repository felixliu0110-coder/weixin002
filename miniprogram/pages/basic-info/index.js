const { toast, navigate } = require("../../utils/interaction");
const api = require("../../utils/api");

Page({
  data: {
    genderOptions: [
      { label: "女性", value: "female" },
      { label: "男性", value: "male" }
    ],
    gender: "female",
    height: 165,
    weight: 50
  },
  onLoad() {
    // 回填已保存档案：编辑场景必须看到当前值而非默认值
    api.getAvatarProfile().then((p) => {
      if (!p || p.isExample) return;
      this.setData({
        gender: p.gender || this.data.gender,
        height: p.heightCm || this.data.height,
        weight: p.weightKg || this.data.weight
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
  next() {
    // 先保存成功再跳转：云模式下避免下一页读到旧档案（保存与跳转竞态）
    api.saveAvatarProfile({
      gender: this.data.gender,
      heightCm: this.data.height,
      weightKg: this.data.weight
    }).then(() => {
      navigate("/pages/body-params/index");
    }).catch(() => {
      toast("保存失败，请重试");
    });
  }
});

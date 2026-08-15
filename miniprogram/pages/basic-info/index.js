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
  onGender(e) {
    const gender = e.detail.value;
    this.setData({ gender });
    toast("性别已设为「" + (gender === "female" ? "女" : "男") + "」");
  },
  onHeight(e) { this.setData({ height: e.detail.value }); },
  onWeight(e) { this.setData({ weight: e.detail.value }); },
  next() {
    api.saveAvatarProfile({
      gender: this.data.gender,
      heightCm: this.data.height,
      weightKg: this.data.weight
    });
    navigate("/pages/body-params/index");
  }
});

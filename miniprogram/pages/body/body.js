const { toast, navigate } = require("../../utils/interaction");
const api = require("../../utils/api");

Page({
  data: { profile: null, complete: false, fields: [] },
  onShow() { this.load(); },
  load() {
    api.getAvatarProfile().then((p) => {
      if (!p || p.isExample) { this.setData({ profile: null, complete: false }); return; }
      const fields = [
        { label: "性别", value: p.gender === "male" ? "男" : (p.gender === "female" ? "女" : "—") },
        { label: "身高", value: p.heightCm != null ? p.heightCm + " cm" : "未填写" },
        { label: "体重", value: p.weightKg != null ? p.weightKg + " kg" : "未填写" },
        { label: "肩宽", value: p.shoulderCm != null ? p.shoulderCm + " cm" : "未填写" },
        { label: "胸围", value: p.bustCm != null ? p.bustCm + " cm" : "未填写" },
        { label: "腰围", value: p.waistCm != null ? p.waistCm + " cm" : "未填写" },
        { label: "臀围", value: p.hipCm != null ? p.hipCm + " cm" : "未填写" },
        { label: "腿长", value: p.legLengthCm != null ? p.legLengthCm + " cm" : "未填写" },
        { label: "臂长", value: p.armLengthCm != null ? p.armLengthCm + " cm" : "未填写" },
        { label: "颈长", value: p.neckLengthCm != null ? p.neckLengthCm + " cm" : "未填写" }
      ];
      const filled = fields.filter(f => f.value !== "未填写").length;
      this.setData({ profile: p, fields, complete: filled >= 6 });
    }).catch(() => this.setData({ profile: null }));
  },
  goEdit() { navigate("/pages/body-edit/index"); }
});

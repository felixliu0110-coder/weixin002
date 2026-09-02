const { toast, navigateBack } = require("../../utils/interaction");
const api = require("../../utils/api");

const FIELDS = [
  { key: "gender", label: "性别", type: "select", options: [{v:"female",t:"女"},{v:"male",t:"男"}] },
  { key: "heightCm", label: "身高 (cm)", type: "number" },
  { key: "weightKg", label: "体重 (kg)", type: "number" },
  { key: "shoulderCm", label: "肩宽 (cm)", type: "number" },
  { key: "bustCm", label: "胸围 (cm)", type: "number" },
  { key: "waistCm", label: "腰围 (cm)", type: "number" },
  { key: "hipCm", label: "臀围 (cm)", type: "number" },
  { key: "legLengthCm", label: "腿长 (cm)", type: "number" },
  { key: "armLengthCm", label: "臂长 (cm)", type: "number" },
  { key: "neckLengthCm", label: "颈长 (cm)", type: "number" }
];

Page({
  data: { fields: FIELDS, form: {} },
  onLoad() {
    api.getAvatarProfile().then((p) => {
      if (!p || p.isExample) return;
      const form = {};
      FIELDS.forEach(f => { if (p[f.key] != null) form[f.key] = String(p[f.key]); });
      this.setData({ form });
    }).catch(() => {});
  },
  // 精确回填：用户输入为空时保持 null（禁止默认值冒充）
  onChange(e) {
    const key = e.currentTarget.dataset.key;
    const val = e.detail.value;
    this.setData({ [`form.${key}`]: val });
  },
  onSelect(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ [`form.${key}`]: e.detail.value });
  },
  save() {
    const f = this.data.form;
    const data = { gender: f.gender || "" };
    ["heightCm","weightKg","shoulderCm","bustCm","waistCm","hipCm","legLengthCm","armLengthCm","neckLengthCm"].forEach(k => {
      const v = (f[k] || "").trim();
      data[k] = v === "" ? null : parseFloat(v); // 空 → null，不写默认值
    });
    api.saveAvatarProfile(data).then(() => {
      toast("已保存");
      setTimeout(() => navigateBack(), 400);
    }).catch(() => toast("保存失败，请重试"));
  }
});

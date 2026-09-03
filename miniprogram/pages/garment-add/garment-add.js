const { toast, navigateBack } = require("../../utils/interaction");
const api = require("../../utils/api");

Page({
  data: {
    name: "", category: "上衣", sizeLabel: "",
    lengthCm: "", chestWidthCm: "", shoulderWidthCm: "", sleeveLengthCm: "",
    tempPath: "", uploading: false,
    categories: ["上衣", "裤子"]
  },
  pickPhoto(e) {
    const source = e.currentTarget.dataset.mode === "camera" ? ["camera"] : ["album"];
    wx.chooseMedia({ count: 1, mediaType: ["image"], sourceType: source, success: (res) => {
      const f = res.tempFiles && res.tempFiles[0];
      if (f) this.setData({ tempPath: f.tempFilePath });
    }});
  },
  onName(e) { this.setData({ name: e.detail.value }); },
  onCategory(e) { this.setData({ category: e.currentTarget.dataset.cat }); },
  onSize(e) { this.setData({ sizeLabel: e.detail.value }); },
  onInput(e) { this.setData({ [e.currentTarget.dataset.field]: e.detail.value }); },
  submit() {
    const d = this.data;
    if (!d.name.trim()) return toast("请输入衣物名称");
    if (!d.tempPath) return toast("请先选择衣物图片");
    if (d.uploading) return;
    this.setData({ uploading: true });
    wx.showLoading({ title: "上传中", mask: true });
    wx.cloud.uploadFile({
      cloudPath: "garments/" + Date.now() + "-" + Math.random().toString(36).slice(2, 8) + ".jpg",
      filePath: d.tempPath
    }).then((up) => {
      // 复用现有 uploadGarment（含内容安全检测 + 落库）
      return api.uploadGarment(up.fileID, { name: d.name.trim(), category: d.category });
    }).then((garment) => {
      if (!garment) throw new Error("上传失败");
      if (garment.pass === false) { this.setData({ uploading: false }); wx.hideLoading(); toast(garment.reason || "图片违规"); return; }
      // measurements 仅在填写时传（遵守现有验证，空 → 不传）
      const m = {};
      if (d.lengthCm.trim()) m.lengthCm = parseFloat(d.lengthCm);
      if (d.chestWidthCm.trim()) m.chestWidthCm = parseFloat(d.chestWidthCm);
      if (d.shoulderWidthCm.trim()) m.shoulderWidthCm = parseFloat(d.shoulderWidthCm);
      if (d.sleeveLengthCm.trim()) m.sleeveLengthCm = parseFloat(d.sleeveLengthCm);
      const meas = Object.keys(m).length ? m : null;
      if (meas || d.sizeLabel.trim()) {
        return api.updateGarment(garment.id, { size_label: d.sizeLabel.trim() || null, measurements: meas })
          .then(() => garment);
      }
      return garment;
    }).then(() => {
      this.setData({ uploading: false }); wx.hideLoading(); toast("已添加");
      setTimeout(() => navigateBack(), 400);
    }).catch(() => { this.setData({ uploading: false }); wx.hideLoading(); toast("上传失败"); });
  }
});

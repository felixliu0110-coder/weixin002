const api = require("../../utils/api");
const { navigate, toast } = require("../../utils/interaction");

function resolveImage(src) {
  if (!src || src.indexOf("cloud://") !== 0 || !wx.cloud || !wx.cloud.getTempFileURL) {
    return Promise.resolve(src || "");
  }
  return new Promise((resolve) => {
    wx.cloud.getTempFileURL({
      fileList: [src],
      success: (r) => resolve(r.fileList && r.fileList[0] && r.fileList[0].tempFileURL || src),
      fail: () => resolve(src)
    });
  });
}

Page({
  data: {
    asset: null,
    personImage: "",
    faceImage: "",
    profile: { heightCm: "--", weightKg: "--", shoulderCm: "--", bustCm: "--", waistCm: "--", hipCm: "--", legLengthCm: "--" },
    ready: false
  },

  async loadData() {
    try {
      const profile = await api.getAvatarProfile();
      if (!profile || !profile.id) {
        this.setData({ asset: null, ready: false, personImage: "", faceImage: "" });
        return;
      }
      const asset = await api.getPersonAsset(profile.id);
      const original = asset && (asset.original_photo || asset.originalPhoto || "");
      const front = asset && (asset.front_photo || asset.frontPhoto || "");
      const [personImage, faceImage] = await Promise.all([resolveImage(original), resolveImage(front)]);
      this.setData({ profile, asset, personImage, faceImage, ready: !!asset && !!original });
    } catch (e) {
      console.error("[avatar-3d] loadData failed", e);
      toast((e && e.message) || "人物资产读取失败", 2600);
      this.setData({ asset: null, ready: false, personImage: "", faceImage: "" });
    }
  },

  onShow() { this.loadData(); },
  edit() { navigate("/pages/basic-info/index"); },
  updatePhotos() { navigate("/pages/photo-upload/index"); },
  goTryon() {
    if (!this.data.ready) {
      toast("请先添加一张人物照片");
      return;
    }
    navigate("/pages/tryon-select/index");
  },
});

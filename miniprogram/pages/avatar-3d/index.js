const { toast, navigate } = require("../../utils/interaction");
const api = require("../../utils/api");

Page({
  data: {
    imgError: false,
    profile: { heightCm: "--", weightKg: "--", waistCm: "--", legLengthCm: "--" }
  },
  onLoad() {
    api.getAvatarProfile().then((profile) => {
      this.setData({ profile });
    });
  },
  onImgError() { this.setData({ imgError: true }); },
  onRotate() { toast("已切换旋转视图（示意）"); },
  onMeasure() { toast("身材标注模式已开启（示意）"); },
  onConfirm() { toast("身材档案已保存（示意）"); },
  edit() { navigate("/pages/basic-info/index"); },
  goTryon() { navigate("/pages/tryon-select/index"); }
});

const { toast, navigateAfter, navigate } = require("../../utils/interaction");

Page({
  noop() {},
  onDecline() {
    toast("未同意前不采集任何照片，将使用默认形象");
    navigateAfter("/pages/photo-upload/index", 1400);
  },
  onAccept() {
    navigate("/pages/generate-progress/index");
  },
  onMaskTap() {
    toast("已返回创建向导，可稍后继续");
    navigateAfter("/pages/photo-upload/index", 1100);
  }
});

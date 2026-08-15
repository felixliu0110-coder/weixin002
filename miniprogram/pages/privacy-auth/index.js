const { toast, navigateAfter, navigate } = require("../../utils/interaction");

Page({
  onDecline() {
    toast("未同意前不采集任何照片，将使用默认形象");
    navigateAfter("/pages/photo-upload/index", 1400);
  },
  onAccept() {
    navigate("/pages/generate-progress/index");
  },
  onMaskTap(e) {
    // 仅点击遮罩区域（auth-page 空白处）返回；点击卡片内部不触发
    if (!e.target || !e.target.dataset || !e.target.dataset.mask) return;
    toast("已返回创建向导，可稍后继续");
    navigateAfter("/pages/photo-upload/index", 1100);
  }
});

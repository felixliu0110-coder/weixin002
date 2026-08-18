const { toast, navigate } = require("../../utils/interaction");

Page({
  onDecline() {
    // 不同意：返回上一步，并说明影响（此前跳回 photo-upload，
    // 而 photo-upload 的「生成」又会回到本页，形成死循环）
    toast("未同意授权：将不采集人脸照片，人物形象使用默认形象");
    wx.navigateBack({
      fail: () => navigate("/pages/photo-upload/index")
    });
  },
  onAccept() {
    navigate("/pages/generate-progress/index");
  }
});

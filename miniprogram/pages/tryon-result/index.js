const { toast } = require("../../utils/interaction");

Page({
  data: { angle: "正面" },
  onAngle(e) {
    const angle = e.detail.label;
    this.setData({ angle });
    toast("已切换至「" + angle + "」视角（真实实现将切换生成图）");
  },
  onSave() { toast("已保存到相册（模拟）"); },
  onShare() { toast("分享卡片已生成，含「AI 生成效果，仅供参考」标识"); }
});

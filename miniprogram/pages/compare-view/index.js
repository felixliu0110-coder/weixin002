const { toast } = require("../../utils/interaction");

Page({
  data: {
    selectedId: "left",
    left: { id: "left", name: "针织连衣裙", image: "/assets/img/p14-left.png" },
    right: { id: "right", name: "蓝色衬衫", image: "/assets/img/p14-right.png" }
  },
  onSelect(e) {
    this.setData({ selectedId: e.detail.id });
    toast("已选择「" + e.detail.name + "」保存");
  },
  onSave() { toast("已保存对比图到相册（模拟）"); },
  onShare() { toast("分享对比卡片（已标注 AI 生成）"); }
});

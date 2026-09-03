const { toast, navigate } = require("../../utils/interaction");
const api = require("../../utils/api");

Page({
  data: {
    collectVisible: false,
    templateVisible: false,
    collecting: false,
    tplName: "",
    tplCategory: "",
    categories: ["上衣", "裤子"],
    result: { tryonImage: "", tryonVideo: "", garmentName: "AI 试穿", garments: [] },
    // 保存模板多选相关
    tplGarments: [],      // 本次穿搭的衣物列表（供弹层展示）
    tplSelected: [],      // 用户勾选的衣物索引
    tplEditIndex: -1,     // 当前正在编辑的衣物索引
    tplEditName: "",      // 编辑中的名称
    tplEditCategory: ""   // 编辑中的分类
  },
  onLoad() {
    const r = wx.getStorageSync("aiTryonResult") || {};
    // 禁止默认 AI 示例图片：无真实图片则返回选择页
    if (!r.tryonImage && !r.tryonImageUrl) {
      navigate("/pages/tryon-select/index", { reLaunch: true });
      return;
    }
    this.setData({
      result: Object.assign({ tryonImage: "", tryonVideo: "", garmentName: "AI 试穿", garments: [] }, r),
      collecting: false
    });
  },

  /* ---------- 收藏 ---------- */
  onCollect() {
    if (this._collecting) return;
    this.setData({ collectVisible: true });
  },
  closeCollect() { this.setData({ collectVisible: false }); },

  // 云文件 ID / 网络图先下载再存相册；包内资源路径直接保存
  saveToAlbum(src, done, fail) {
    if (!src) { fail && fail("无图可保存"); return; }
    const doSave = (path) => wx.saveImageToPhotosAlbum({
      filePath: path,
      success: () => done && done(),
      fail: (e) => fail && fail((e && e.errMsg) || "保存失败")
    });
    if (src.indexOf("cloud://") === 0 || src.indexOf("http") === 0) {
      if (src.indexOf("cloud://") === 0 && wx.cloud) {
        wx.cloud.downloadFile({ fileID: src, success: (r) => doSave(r.tempFilePath), fail: () => fail && fail("图片下载失败") });
      } else {
        wx.downloadFile({ url: src, success: (r) => doSave(r.tempFilePath), fail: () => fail && fail("图片下载失败") });
      }
    } else {
      doSave(src);
    }
  },

  collectYes() {
    // 是：收藏 + 保存图片到相册
    if (this._collecting) return;
    this._collecting = true;
    this.setData({ collectVisible: false });
    api.saveAiResult({
      taskId: this.data.result.imageTaskId || this.data.result.taskId || "",
      garmentName: this.data.result.garmentName,
      tryonImage: this.data.result.tryonImage,
      saved: true
    }).then(() => {
      this._collecting = false;
      this.setData({ collecting: true });
      this.saveToAlbum(this.data.result.tryonImage,
        () => toast("已收藏并保存到相册"),
        () => toast("已收藏；保存到相册失败，可在相册权限开启后重试"));
    }).catch(() => {
      this._collecting = false;
      toast("收藏失败，请重试");
    });
  },

  collectNo() {
    // 否：仅收藏（图片）
    if (this._collecting) return;
    this._collecting = true;
    this.setData({ collectVisible: false });
    api.saveAiResult({
      taskId: this.data.result.imageTaskId || this.data.result.taskId || "",
      garmentName: this.data.result.garmentName,
      tryonImage: this.data.result.tryonImage,
      saved: false
    }).then(() => {
      this._collecting = false;
      this.setData({ collecting: true });
      toast("已收藏");
    }).catch(() => {
      this._collecting = false;
      toast("收藏失败，请重试");
    });
  },

  /* ---------- 保存模板（重构：多选衣物分别保存） ---------- */
  onSaveTemplate() {
    const source = this.data.result.garments || [];
    // 历史记录/收藏进入本页时无衣物明细（单条记录只存了合成图）：不开空弹层
    if (!source.length) {
      toast("该记录没有衣物明细，请在生成完成时保存");
      return;
    }
    const garments = source.map((g, i) => Object.assign({}, g, {
      _index: i,
      _checked: false,
      _editName: g.name,
      _editCategory: g.category || "上衣"
    }));
    this.setData({
      templateVisible: true,
      tplGarments: garments,
      tplSelected: [],
      tplEditIndex: -1,
      tplEditName: "",
      tplEditCategory: ""
    });
  },
  closeTemplate() { this.setData({ templateVisible: false }); },

  // 勾选/取消勾选衣物
  toggleTplGarment(e) {
    const idx = e.currentTarget.dataset.idx;
    const garments = this.data.tplGarments.map((g, i) =>
      i === idx ? Object.assign({}, g, { _checked: !g._checked }) : g
    );
    const selected = garments.filter((g) => g._checked).map((g) => g._index);
    this.setData({ tplGarments: garments, tplSelected: selected });
  },

  // 打开单件衣物的编辑弹层
  openTplEdit(e) {
    const idx = e.currentTarget.dataset.idx;
    const g = this.data.tplGarments[idx];
    this.setData({
      tplEditIndex: idx,
      tplEditName: g._editName,
      tplEditCategory: g._editCategory
    });
  },
  closeTplEdit() { this.setData({ tplEditIndex: -1 }); },

  onTplEditName(e) { this.setData({ tplEditName: e.detail.value }); },
  onTplEditCategory(e) { this.setData({ tplEditCategory: e.currentTarget.dataset.cat }); },

  // 保存单件衣物的编辑
  confirmTplEdit() {
    const name = (this.data.tplEditName || "").trim();
    if (!name) {
      toast("请输入衣物名称");
      return;
    }
    if (!this.data.tplEditCategory) {
      toast("请选择衣物分类");
      return;
    }
    const idx = this.data.tplEditIndex;
    const garments = this.data.tplGarments.map((g, i) =>
      i === idx ? Object.assign({}, g, { _editName: name, _editCategory: this.data.tplEditCategory }) : g
    );
    this.setData({ tplGarments: garments, tplEditIndex: -1 });
  },

  // 确认保存：批量保存勾选的衣物
  confirmSaveTemplate() {
    const toSave = this.data.tplGarments.filter((g) => g._checked);
    if (toSave.length === 0) {
      toast("请至少选择一件衣物");
      return;
    }
    // 检查每件是否都有名称和分类
    for (const g of toSave) {
      if (!g._editName.trim()) {
        toast("请为所有选中的衣物填写名称");
        return;
      }
      if (!g._editCategory) {
        toast("请为所有选中的衣物选择分类");
        return;
      }
    }

    this.setData({ templateVisible: false });

    // 串行保存（避免并发问题）
    let saved = 0;
    const saveNext = (i) => {
      if (i >= toSave.length) {
        toast(`已保存 ${saved} 件衣物到模板库`);
        return;
      }
      const g = toSave[i];
      api.saveToTemplates({
        category: g._editCategory,
        name: g._editName.trim(),
        image: g.image
      }).then(() => {
        saved++;
        saveNext(i + 1);
      }).catch(() => {
        toast(`「${g._editName}」保存失败`);
        saveNext(i + 1);
      });
    };
    saveNext(0);
  },

  /* ---------- 分享 ---------- */
  onShare() {
    // 分享按钮由 open-type="share" 触发系统分享，这里仅做提示
    toast("分享内容含「AI 生成效果，仅供参考」标识");
  },
  onShareAppMessage() {
    // 分享卡片：仅分享图片（不分享视频）
    return {
      title: "「" + (this.data.result.garmentName || "AI 试穿") + "」AI 试穿效果（AI 生成效果，仅供参考）",
      path: "/pages/login/index",
      imageUrl: this.data.result.tryonImage
    };
  },

  /* ---------- 跳转到视频生成页 ---------- */
  goToVideoGenerate() {
    navigate("/pages/video-generate/index");
  }
});

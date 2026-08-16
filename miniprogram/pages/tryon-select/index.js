const { toast, navigate, requestSubscribe } = require("../../utils/interaction");
const api = require("../../utils/api");

Page({
  data: {
    tabs: [
      { label: "模板衣物", value: "lib" },
      { label: "上传衣物", value: "upload" }
    ],
    tab: "lib",
    viewMode: "home", // home: 分类入口+我的模板；select: 分类内选择衣物
    categories: ["上衣", "裤子", "头饰", "鞋子", "其他"],
    catEmojis: { "上衣": "👕", "裤子": "👖", "头饰": "🧢", "鞋子": "👟", "其他": "📦" },
    curCategory: "上衣",
    garmentLibrary: [],
    libItems: [],
    libSelectedCount: 0,
    libManageMode: false,
    libDelCount: 0,
    myTemplates: [],
    catCounts: {},
    selectedIds: [],
    selectedCount: 0,
    manageMode: false,
    delCount: 0,
    buttonText: "生成穿搭",
    uploadName: "",
    uploadCategory: "上衣",
    uploadVisible: false,
    infoVisible: false
  },
  onLoad() {
    this.loadAll();
  },
  onShow() {
    if (typeof this.getTabBar === "function" && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1, navMode: false, pill: false });
    }
    // 从进度/预览页返回时重置防抖标记，允许重新提交/上传
    this._submitting = false;
    this._picking = false;
  },
  onTab(e) {
    const tab = e.detail.value;
    this.setData({ tab });
    if (tab === "upload") {
      this.setData({ uploadVisible: true });
    }
  },

  /* ---------- 数据加载 ---------- */
  loadAll() {
    api.getGarmentLibrary().then((lib) => {
      this.setData({
        garmentLibrary: lib,
        libItems: lib.filter((i) => i.category === this.data.curCategory)
      });
      this.computeCatCounts(lib);
    });
    api.getMyTemplates().then((my) => {
      this.setData({ myTemplates: my.map((t) => Object.assign({}, t, { selected: false, del: false })) });
    });
  },
  computeCatCounts(lib) {
    const counts = {};
    this.data.categories.forEach((c) => {
      counts[c] = lib.filter((i) => i.category === c).length;
    });
    this.setData({ catCounts: counts });
  },

  /* ---------- 分类入口 / 选择视图 ---------- */
  onCatCard(e) {
    this.setData({
      viewMode: "select",
      curCategory: e.currentTarget.dataset.cat
    });
    this.refreshLib();
  },
  onCategoryTab(e) {
    this.setData({ curCategory: e.currentTarget.dataset.cat });
    this.refreshLib();
  },
  refreshLib() {
    this.setData({
      libItems: this.data.garmentLibrary
        .filter((i) => i.category === this.data.curCategory)
        .map((t) => Object.assign({}, t, { selected: false, delLib: false })),
      libSelectedCount: 0,
      libManageMode: false,
      libDelCount: 0
    });
  },
  backHome() {
    this.setData({ viewMode: "home" });
    this.loadAll();
  },
  onLibSelect(e) {
    const id = e.detail.id;
    if (this.data.libManageMode) {
      const libItems = this.data.libItems.map((t) =>
        t.id === id ? Object.assign({}, t, { delLib: !t.delLib }) : t
      );
      this.setData({ libItems, libDelCount: libItems.filter((t) => t.delLib).length });
      return;
    }
    const libItems = this.data.libItems.map((t) =>
      t.id === id ? Object.assign({}, t, { selected: !t.selected }) : t
    );
    this.setData({
      libItems,
      libSelectedCount: libItems.filter((t) => t.selected).length
    });
  },
  toggleLibManage() {
    const libManageMode = !this.data.libManageMode;
    const libItems = this.data.libItems.map((t) => Object.assign({}, t, { delLib: false }));
    this.setData({ libManageMode, libItems, libDelCount: 0 });
  },
  confirmDelLib() {
    const ids = this.data.libItems.filter((t) => t.delLib).map((t) => t.id);
    if (ids.length === 0) {
      toast("请先选择要删除的衣物");
      return;
    }
    wx.showModal({
      title: "删除模板衣物",
      content: `将删除 ${ids.length} 件模板衣物，删除后不可恢复。`,
      confirmText: "删除",
      confirmColor: "#C0392B",
      success: (res) => {
        if (res.confirm) {
          api.deleteItems("library", ids).then(() => {
            toast("已删除");
            this.loadAll();
            this.refreshLib();
          });
        }
      }
    });
  },
  confirmAdd() {
    const ids = this.data.libItems.filter((t) => t.selected).map((t) => t.id);
    if (ids.length === 0) {
      toast("请先选择衣物加入穿搭");
      return;
    }
    api.addToMyTemplates(ids).then(() => {
      toast("已加入穿搭");
      this.setData({ viewMode: "home" });
      this.loadAll();
    });
  },

  /* ---------- 我的模板：选择试穿 ---------- */
  toggleGarment(e) {
    const id = e.detail.id;
    const name = e.detail.name;
    const myTemplates = this.data.myTemplates.map((t) =>
      t.id === id ? Object.assign({}, t, { selected: !t.selected }) : t
    );
    const count = myTemplates.filter((t) => t.selected).length;
    const chosen = myTemplates.find((t) => t.id === id);
    this.setData({
      myTemplates,
      selectedCount: count,
      buttonText: count > 0 ? "生成穿搭（已选 " + count + " 件）" : "生成穿搭"
    });
    toast(chosen.selected ? "已选择「" + name + "」" : "已取消选择");
  },
  startTryon() {
    if (this.data.selectedCount === 0) {
      toast("请先选择一件衣物");
      return;
    }
    if (this._submitting) return;
    this._submitting = true;
    const items = this.data.myTemplates.filter((t) => t.selected);
    const avatarViewId = wx.getStorageSync("avatarViewId") || "av-current";
    // 每件选中衣物都要预生成四视图（此前只处理第一件，多件时后续衣物视图缺失）
    requestSubscribe()
      .then(() => Promise.all(items.map((g) => api.ensureGarmentViews(g.id, g.name, g.image))))
      .then(() => {
        return api.submitAiTryon({
          avatarViewId,
          garmentIds: items.map((g) => g.id),
          garmentNames: items.map((g) => g.name)
        });
      })
      .then((res) => {
        if (res && res.error) {
          this._submitting = false;
          toast("生成失败：" + res.error);
          return;
        }
        const names = items.map((g) => g.name).join("、");
        wx.setStorageSync("aiTryonTask", { taskId: res.taskId, garmentName: names });
        this._submitting = false;
        navigate("/pages/tryon-progress/index");
      })
      .catch(() => {
        this._submitting = false;
        toast("提交失败，请重试");
      });
  },

  /* ---------- 我的模板：管理删除 ---------- */
  toggleManage() {
    const manageMode = !this.data.manageMode;
    const myTemplates = this.data.myTemplates.map((t) => Object.assign({}, t, { del: false }));
    this.setData({ manageMode, myTemplates, delCount: 0 });
  },
  onItemTap(e) {
    if (this.data.manageMode) {
      const id = e.detail.id;
      const myTemplates = this.data.myTemplates.map((t) =>
        t.id === id ? Object.assign({}, t, { del: !t.del }) : t
      );
      this.setData({ myTemplates, delCount: myTemplates.filter((t) => t.del).length });
    } else {
      this.toggleGarment(e);
    }
  },
  onLongPress(e) {
    if (!this.data.manageMode) {
      const id = e.detail.id;
      const myTemplates = this.data.myTemplates.map((t) =>
        t.id === id ? Object.assign({}, t, { del: true }) : Object.assign({}, t, { del: false })
      );
      this.setData({ manageMode: true, myTemplates, delCount: 1 });
    }
  },
  onDelete() {
    const ids = this.data.myTemplates.filter((t) => t.del).map((t) => t.id);
    const count = ids.length;
    if (count === 0) {
      toast("请先选择要删除的衣物");
      return;
    }
    wx.showModal({
      title: "删除模板衣物",
      content: `将删除 ${count} 件模板衣物，删除后不可恢复。`,
      confirmText: "删除",
      confirmColor: "#C0392B",
      success: (res) => {
        if (res.confirm) {
          api.deleteItems("myTemplates", ids).then(() => {
            toast("已删除");
            this.setData({ manageMode: false });
            this.loadAll();
          });
        }
      }
    });
  },

  /* ---------- 上传衣物 ---------- */
  openUpload() { this.setData({ uploadVisible: true }); },
  closeUpload() { this.setData({ uploadVisible: false }); },
  pickPhoto(e) {
    const sourceType = e.currentTarget.dataset.mode === "camera" ? ["camera"] : ["album"];
    wx.chooseMedia({
      count: 1,
      mediaType: ["image"],
      sourceType,
      success: (res) => {
        const f = res.tempFiles && res.tempFiles[0];
        if (!f) return;
        this._uploadTempPath = f.tempFilePath;
        this.setData({ uploadVisible: false, infoVisible: true, uploadName: "", uploadCategory: "上衣" });
      }
    });
  },
  closeInfo() { this.setData({ infoVisible: false }); },
  onInfoName(e) { this.setData({ uploadName: e.detail.value }); },
  onInfoCategory(e) { this.setData({ uploadCategory: e.currentTarget.dataset.cat }); },
  confirmUpload() {
    const name = (this.data.uploadName || "").trim();
    if (!name) {
      toast("请输入衣物名称");
      return;
    }
    if (!this._uploadTempPath) {
      toast("请先选择衣物图片");
      return;
    }
    if (this._picking) return;
    this._picking = true;
    this.setData({ infoVisible: false });
    wx.showLoading({ title: "上传中", mask: true });
    let uploadedFileID = "";
    wx.cloud.uploadFile({
      cloudPath: "garments/" + Date.now() + "-" + Math.random().toString(36).slice(2, 8) + ".jpg",
      filePath: this._uploadTempPath
    }).then((up) => {
      uploadedFileID = up.fileID;
      return wx.cloud.callFunction({ name: "uploadGarment", data: { fileID: up.fileID } });
    }).then((res) => {
      const r = res.result;
      if (!r || !r.ok) throw new Error((r && r.error) || "内容检测失败，请重试");
      if (!r.pass) {
        this._picking = false;
        wx.hideLoading();
        toast(r.reason || "图片内容违规，请更换后重试", 2600);
        return;
      }
      return api.uploadGarment(uploadedFileID, { name, category: this.data.uploadCategory });
    }).then((garment) => {
      if (!garment) return;
      this._picking = false;
      wx.hideLoading();
      wx.setStorageSync("uploadedGarment", garment);
      toast("已上传「" + name + "」");
      setTimeout(() => navigate("/pages/image-preview/index"), 600);
    }).catch(() => {
      // 失败必须重置标记，否则上传按钮永久失效
      this._picking = false;
      wx.hideLoading();
      toast("上传失败，请重试");
    });
  }
});

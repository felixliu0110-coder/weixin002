const { toast, navigate, requestSubscribe } = require("../../utils/interaction");
const api = require("../../utils/api");

Page({
  data: {
    tabs: [
      { label: "模板衣物", value: "lib" },
      { label: "上传", value: "upload" }
    ],
    tab: "lib",
    viewMode: "home", // home: 分类入口+我的模板；select: 分类内选择衣物
    categories: ["上衣", "裤子", "头饰", "鞋子", "其他"],
    catIcons: { "上衣": "/assets/icons/svg/cat-top.svg", "裤子": "/assets/icons/svg/cat-pants.svg", "头饰": "/assets/icons/svg/cat-hat.svg", "鞋子": "/assets/icons/svg/cat-shoes.svg", "其他": "/assets/icons/svg/cat-other.svg" },
    curCategory: "上衣",
    garmentLibrary: [],
    libItems: [],
    libSelectedCount: 0,
    libManageMode: false,
    libDelCount: 0,
    myTemplates: [],
    myGarments: [],
    catCounts: {},
    selectedIds: [],
    selectedCount: 0,
    manageMode: false,
    delCount: 0,
    buttonText: "生成穿搭",
    uploadName: "",
    uploadCategory: "上衣",
    uploadVisible: false,
    infoVisible: false,
    editVisible: false,
    helpVisible: false,
    editingGarment: null,
    editName: "",
    editCategory: "上衣",
    editSizeLabel: "",
    editLengthCm: "",
    editChestWidthCm: "",
    editShoulderWidthCm: "",
    editSleeveLengthCm: ""
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
    api.getMyGarments().then((my) => {
      this.setData({ myGarments: my.map((g) => Object.assign({}, g, { selected: false })) });
    });
  },
  computeSelectInfo(myTemplates, myGarments) {
    const count =
      myTemplates.filter((t) => t.selected).length +
      (myGarments || []).filter((t) => t.selected).length;
    return {
      selectedCount: count,
      buttonText: count > 0 ? "生成穿搭（已选 " + count + " 件）" : "生成穿搭"
    };
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
    const items = this.data.libItems.filter((t) => t.delLib);
    const ids = items.map((t) => t.id);
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
          api.deleteItems("library", ids)
            .then(() => {
              toast("已删除");
              this.loadAll();
              this.refreshLib();
            })
            .catch(() => toast("删除失败，请重试"));
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
    const chosen = myTemplates.find((t) => t.id === id);
    const info = this.computeSelectInfo(myTemplates, this.data.myGarments);
    this.setData(Object.assign({ myTemplates }, info));
    toast(chosen.selected ? "已选择「" + name + "」" : "已取消选择");
  },
  onMyGarmentTap(e) {
    this.toggleMyGarment(e);
  },
  toggleMyGarment(e) {
    const id = e.detail.id;
    const name = e.detail.name;
    const myGarments = this.data.myGarments.map((t) =>
      t.id === id ? Object.assign({}, t, { selected: !t.selected }) : t
    );
    const chosen = myGarments.find((t) => t.id === id);
    const info = this.computeSelectInfo(this.data.myTemplates, myGarments);
    this.setData(Object.assign({ myGarments }, info));
    toast(chosen.selected ? "已选择「" + name + "」" : "已取消选择");
  },
  startTryon() {
    if (this.data.selectedCount === 0) {
      toast("请先选择一件衣物");
      return;
    }
    if (this._submitting) return;
    this._submitting = true;
    const items = this.data.myTemplates
      .filter((t) => t.selected)
      .concat(this.data.myGarments.filter((t) => t.selected));
    const names = items.map((g) => g.name).join("、");
    // 订阅消息授权需在用户点击的调用栈中请求（微信限制）；
    // 授权完成后立即跳转进度页，实际的四视图预处理与任务提交由 tryon-progress 页内完成，本页不等待
    requestSubscribe().then(() => {
      // 将待生成的衣物信息存入 storage（含分类，供结果页"保存模板"按单件衣物归档）
      wx.setStorageSync("aiTryonPending", {
        garmentIds: items.map((g) => g.id),
        garmentNames: items.map((g) => g.name),
        garmentImages: items.map((g) => g.image),
        garmentCategories: items.map((g) => g.category || "其他"),
        displayName: names
      });
      this._submitting = false;
      navigate("/pages/tryon-progress/index");
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
    wx.cloud.uploadFile({
      cloudPath: "garments/" + Date.now() + "-" + Math.random().toString(36).slice(2, 8) + ".jpg",
      filePath: this._uploadTempPath
    }).then((up) => {
      // 服务端落库 + 内容安全检测，返回服务端生成的 garmentId
      return api.uploadGarment(up.fileID, { name, category: this.data.uploadCategory });
    }).then((garment) => {
      if (!garment) return;
      if (garment.pass === false) {
        this._picking = false;
        wx.hideLoading();
        toast(garment.reason || "图片内容违规，请更换后重试", 2600);
        return;
      }
      if (!garment.id) throw new Error("上传失败");
      this._picking = false;
      wx.hideLoading();
      wx.setStorageSync("uploadedGarment", garment);
      toast("已上传「" + name + "」");
      // 真实 garmentId 立即进入当前列表，不依赖 storage.uploadedGarment
      const myGarments = this.data.myGarments.concat(Object.assign({}, garment, { selected: false }));
      this.setData({ myGarments });
      setTimeout(() => navigate("/pages/image-preview/index"), 600);
    }).catch(() => {
      // 失败必须重置标记，否则上传按钮永久失效
      this._picking = false;
      wx.hideLoading();
      toast("上传失败，请重试");
    });
  },

  onMyGarmentLongPress(e) {
    const id = e.detail.id;
    const item = this.data.myGarments.find((g) => g.id === id);
    if (!item) return;
    wx.showModal({
      title: "删除衣物",
      content: `将删除「${item.name}」及其云端原图，删除后不可恢复。`,
      confirmText: "删除",
      confirmColor: "#C0392B",
      success: (res) => {
        if (res.confirm) this.doDeleteMyGarments([id]);
      }
    });
  },

  doDeleteMyGarments(ids) {
    api.deleteMyGarments(ids)
      .then(() => {
        toast("已删除");
        this.setData({ myGarments: this.data.myGarments.filter((g) => !ids.includes(g.id)) });
      })
      .catch(() => toast("删除失败，请重试"));
  },

  /* ---------- 编辑入口 ---------- */
  openEditSheet(e) {
    const id = e.detail.id;
    const item = this.data.myGarments.find((g) => g.id === id);
    if (!item) return;
    const m = item.measurements || {};
    this.setData({
      editVisible: true,
      editingGarment: item,
      editName: item.name || "",
      editCategory: item.category || "上衣",
      editSizeLabel: item.size_label || "",
      editLengthCm: m.lengthCm !== undefined ? String(m.lengthCm) : "",
      editChestWidthCm: m.chestWidthCm !== undefined ? String(m.chestWidthCm) : "",
      editShoulderWidthCm: m.shoulderWidthCm !== undefined ? String(m.shoulderWidthCm) : "",
      editSleeveLengthCm: m.sleeveLengthCm !== undefined ? String(m.sleeveLengthCm) : ""
    });
  },
  closeEditSheet() {
    this.setData({ editVisible: false, editingGarment: null });
  },
  onEditName(e) { this.setData({ editName: e.detail.value }); },
  onEditCategory(e) { this.setData({ editCategory: e.currentTarget.dataset.cat }); },
  onEditSizeLabel(e) { this.setData({ editSizeLabel: e.detail.value }); },
  onEditLengthCm(e) { this.setData({ editLengthCm: e.detail.value }); },
  onEditChestWidthCm(e) { this.setData({ editChestWidthCm: e.detail.value }); },
  onEditShoulderWidthCm(e) { this.setData({ editShoulderWidthCm: e.detail.value }); },
  onEditSleeveLengthCm(e) { this.setData({ editSleeveLengthCm: e.detail.value }); },

  showMeasureHelp() { this.setData({ helpVisible: true }); },
  closeMeasureHelp() { this.setData({ helpVisible: false }); },

  saveEdit() {
    const item = this.data.editingGarment;
    if (!item) return;
    const name = (this.data.editName || "").trim();
    if (!name) { toast("请输入衣物名称"); return; }
    const category = this.data.editCategory;
    const size_label = (this.data.editSizeLabel || "").trim() || undefined;
    const measurements = {};
    if (this.data.editLengthCm.trim()) measurements.lengthCm = parseFloat(this.data.editLengthCm);
    if (this.data.editChestWidthCm.trim()) measurements.chestWidthCm = parseFloat(this.data.editChestWidthCm);
    if (this.data.editShoulderWidthCm.trim()) measurements.shoulderWidthCm = parseFloat(this.data.editShoulderWidthCm);
    if (this.data.editSleeveLengthCm.trim()) measurements.sleeveLengthCm = parseFloat(this.data.editSleeveLengthCm);
    wx.showLoading({ title: "保存中", mask: true });
    api.updateGarment(item.id, { name, category, size_label, measurements })
      .then((updated) => {
        const myGarments = this.data.myGarments.map((g) =>
          g.id === item.id ? Object.assign({}, g, updated) : g
        );
        this.setData({ myGarments, editVisible: false, editingGarment: null });
        toast("已保存");
      })
      .catch((e) => {
        wx.hideLoading();
        toast((e && e.message) || "保存失败，请重试");
      });
  }
});
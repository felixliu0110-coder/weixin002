Component({
  properties: {
    selected: { type: Number, value: 0 },
    navMode: { type: Boolean, value: false },
    pill: { type: Boolean, value: false }
  },
  data: {
    // Phase 5-1：tabBar 收敛为 3 项（首页 / 衣橱 / 我的）；收藏页保留但移出 tab 入口
    list: [
      { pagePath: "/pages/home/index", text: "首页", type: "home" },
      { pagePath: "/pages/wardrobe/index", text: "衣橱", type: "hanger" },
      { pagePath: "/pages/profile/index", text: "我的", type: "user" }
    ]
  },
  methods: {
    onSelect(e) {
      const index = e.currentTarget.dataset.index;
      const item = this.data.list[index];
      // 连点防护：600ms 内重复点击同一 Tab 直接忽略，避免 switchTab 连发与选中态闪烁
      const now = Date.now();
      if (this._lastTapAt && now - this._lastTapAt < 600 && this._lastTapIndex === index) return;
      this._lastTapAt = now;
      this._lastTapIndex = index;
      // 立即更新选中高亮，避免切换时选中态滞后造成晃动
      this.setData({ selected: index });
      wx.switchTab({ url: item.pagePath });
    }
  }
});

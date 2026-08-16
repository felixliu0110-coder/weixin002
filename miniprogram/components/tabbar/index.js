Component({
  properties: {
    selected: { type: Number, value: 0 },
    navMode: { type: Boolean, value: false },
    pill: { type: Boolean, value: false }
  },
  data: {
    list: [
      { pagePath: "/pages/home/index", text: "主页", type: "home" },
      { pagePath: "/pages/tryon-select/index", text: "试衣", type: "hanger" },
      { pagePath: "/pages/favorites/index", text: "收藏", type: "heart" },
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
      // 四个目标均为 tabBar 页面：必须用 switchTab（navigateTo 无法打开 tabBar 页）
      wx.switchTab({ url: item.pagePath });
    }
  }
});

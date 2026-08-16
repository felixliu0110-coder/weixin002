Component({
  properties: {
    selected: { type: Number, value: 0 },
    navMode: { type: Boolean, value: false },
    pill: { type: Boolean, value: false }
  },
  data: {
    list: [
      { pagePath: "/pages/home/index", text: "主页", icon: "/assets/icons/png/icon-home-gray.png", iconActive: "/assets/icons/png/icon-home-active.png" },
      { pagePath: "/pages/tryon-select/index", text: "试衣", icon: "/assets/icons/png/icon-hanger-gray.png", iconActive: "/assets/icons/png/icon-hanger-active.png" },
      { pagePath: "/pages/favorites/index", text: "收藏", icon: "/assets/icons/png/icon-heart-gray.png", iconActive: "/assets/icons/png/icon-heart-active.png" },
      { pagePath: "/pages/profile/index", text: "我的", icon: "/assets/icons/png/icon-user-gray.png", iconActive: "/assets/icons/png/icon-user-active.png" }
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

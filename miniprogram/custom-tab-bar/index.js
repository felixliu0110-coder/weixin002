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
      { pagePath: "/pages/history/index", text: "收藏", icon: "/assets/icons/png/icon-heart-gray.png", iconActive: "/assets/icons/png/icon-heart-active.png" },
      { pagePath: "/pages/profile/index", text: "我的", icon: "/assets/icons/png/icon-user-gray.png", iconActive: "/assets/icons/png/icon-user-active.png" }
    ]
  },
  methods: {
    onSelect(e) {
      const index = e.currentTarget.dataset.index;
      const item = this.data.list[index];
      wx.switchTab({ url: item.pagePath });
    }
  }
});

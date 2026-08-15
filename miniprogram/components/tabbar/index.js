Component({
  properties: {
    selected: { type: Number, value: 0 },
    navMode: { type: Boolean, value: false },
    pill: { type: Boolean, value: false }
  },
  data: {
    list: [
      { pagePath: "/pages/home/index", text: "主页", icon: "icon-home" },
      { pagePath: "/pages/tryon-select/index", text: "试衣", icon: "icon-hanger" },
      { pagePath: "/pages/history/index", text: "收藏", icon: "icon-heart" },
      { pagePath: "/pages/profile/index", text: "我的", icon: "icon-user" }
    ]
  },
  methods: {
    onSelect(e) {
      const index = e.currentTarget.dataset.index;
      const item = this.data.list[index];
      if (index === this.data.selected) return;
      this.setData({ selected: index });
      // 四个目标均为 tabBar 页面：必须用 switchTab（navigateTo 无法打开 tabBar 页）
      wx.switchTab({ url: item.pagePath });
    }
  }
});

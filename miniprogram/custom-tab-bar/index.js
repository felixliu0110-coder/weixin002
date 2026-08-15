Component({
  data: {
    selected: 0,
    navMode: false,
    pill: false,
    list: [
      { pagePath: "/pages/home/index", text: "发现", icon: "icon-home" },
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
      if (this.data.navMode) {
        wx.navigateTo({ url: item.pagePath });
      } else {
        wx.switchTab({ url: item.pagePath });
      }
    }
  }
});

const { navigate } = require("../../utils/interaction");
const api = require("../../utils/api");

Page({
  data: { favorites: [] },
  onLoad() {
    this.loadFavorites();
  },
  onShow() {
    this.loadFavorites();
    if (typeof this.getTabBar === "function" && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2, navMode: false, pill: false });
    }
  },
  loadFavorites() {
    api.getFavorites().then((favorites) => {
      this.setData({ favorites });
    });
  },
  openResult() {
    navigate("/pages/tryon-result/index");
  }
});

const { navigate } = require("../../utils/interaction");

Page({
  onDecline() {
    navigate("/pages/photo-upload/index");
  },
  onAccept() {
    navigate("/pages/generate-progress/index");
  }
});

/* 即梦/火山方舟适配器：P0 只做配置检测与明确报错；真实接口接入见 P1（设计文档 §10） */
function getKey() {
  return process.env.JIMENG_API_KEY || process.env.AIGC_API_KEY || "";
}

function notConfiguredError() {
  const err = new Error("AIGC_NOT_CONFIGURED: 未配置 JIMENG_API_KEY / AIGC_API_KEY 环境变量");
  err.code = "AIGC_NOT_CONFIGURED";
  return err;
}

module.exports = {
  name: "jimeng",
  isConfigured() {
    return !!getKey();
  },
  async generateImages() {
    if (!getKey()) throw notConfiguredError();
    // P1：调用即梦/火山方舟生图接口（按三视图/四视图提示词 + 参考图）
    throw Object.assign(new Error("JIMENG_IMAGES_NOT_IMPLEMENTED: 真实生图接口将在 P1 接入"), { code: "JIMENG_IMAGES_NOT_IMPLEMENTED" });
  },
  async generateVideo() {
    if (!getKey()) throw notConfiguredError();
    // P1：调用即梦/火山方舟图生视频接口
    throw Object.assign(new Error("JIMENG_VIDEO_NOT_IMPLEMENTED: 真实视频接口将在 P1 接入"), { code: "JIMENG_VIDEO_NOT_IMPLEMENTED" });
  }
};

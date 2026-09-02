/* mock 适配器：Key 未配置或开发自测时使用，返回占位 URL */
const MOCK_IMAGE = "https://placeholder.example.com/mock.jpg";
const MOCK_VIDEO = "https://placeholder.example.com/mock.mp4";

module.exports = {
  name: "mock",
  async generateImages({ count }) {
    return { urls: Array(count || 1).fill(MOCK_IMAGE), provider: "mock" };
  },
  async generateVideo() {
    return { videoUrl: MOCK_VIDEO, provider: "mock" };
  }
};

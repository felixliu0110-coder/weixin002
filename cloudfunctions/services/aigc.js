const mock = require("./aigc-mock");
const agnes = require("./aigc-agnes");

function getAigc() {
  const agnesConfigured = agnes.isConfigured();
  const aliyunConfigured = !!process.env.DASHSCOPE_API_KEY;
  const mockEnabled = process.env.AIGC_MOCK_ENABLED === "true" || process.env.AIGC_MOCK_ENABLED === "1";
  if (agnesConfigured && aliyunConfigured) {
    const err = new Error("AI_PROVIDER_CONFIGURATION_CONFLICT");
    err.code = "AI_PROVIDER_CONFIGURATION_CONFLICT";
    throw err;
  }
  if (agnesConfigured) return agnes;
  if (mockEnabled) return mock;
  const err = new Error("AIGC_NOT_CONFIGURED: 未配置真实 AI Provider，且 Mock 未显式开启");
  err.code = "AIGC_NOT_CONFIGURED";
  throw err;
}

module.exports = { getAigc };

/**
 * Try-On Engine 入口
 * 
 * 统一接口：generate(params, strategy)
 */

const { getRouter } = require('./router');
const { STRATEGY_NAMES } = require('./types');

/**
 * 主入口函数
 * @param {Object} params
 * @param {string} params.personImage - 人物图 HTTPS URL
 * @param {string} params.garmentImage - 衣物图 HTTPS URL
 * @param {string} params.category - tops|bottoms|dress
 * @param {string} params.strategy - FAST|BALANCED|QUALITY|FAILOVER
 * @returns {Promise<Object>}
 */
async function generate(params = {}, strategy = STRATEGY_NAMES.BALANCED) {
  const router = getRouter();
  return router.generate(params, strategy);
}

/**
 * 获取引擎状态
 */
function getStatus() {
  const router = getRouter();
  return router.getStatus();
}

/**
 * 获取可用 Provider 列表
 */
function getAvailableProviders() {
  const router = getRouter();
  return router.getAvailableProviders();
}

module.exports = {
  generate,
  getStatus,
  getAvailableProviders,
  // 兼容旧接口
  tryOn: { generate }
};

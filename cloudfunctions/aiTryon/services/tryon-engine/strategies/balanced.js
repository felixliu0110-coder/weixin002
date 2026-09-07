/**
 * Try-On Engine - 均衡模式策略
 * 
 * 使用 V1 唯一生产 Provider：阿里云 aitryon；失败不跨 Provider 自动降级
 */

const { STRATEGY_NAMES } = require('./types');
const { getRouter } = require('../router');

async function generate(params) {
  const router = getRouter();
  return router.generate(params, STRATEGY_NAMES.BALANCED);
}

module.exports = {
  name: STRATEGY_NAMES.BALANCED,
  generate
};

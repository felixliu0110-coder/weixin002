/**
 * Try-On Engine - 均衡模式策略
 * 
 * 优先使用 aitryon，降级到 Agnes
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

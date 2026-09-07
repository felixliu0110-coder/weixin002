/**
 * Try-On Engine - 快速模式策略
 * 
 * 使用阿里云 aitryon；V1 不跨 Provider 自动降级
 */

const { STRATEGY_NAMES } = require('./types');
const { getRouter } = require('../router');

async function generate(params) {
  const router = getRouter();
  return router.generate(params, STRATEGY_NAMES.FAST);
}

module.exports = {
  name: STRATEGY_NAMES.FAST,
  generate
};

/**
 * Try-On Engine - 快速模式策略
 * 
 * 使用 Agnes 生成，低成本快速响应
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

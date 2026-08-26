/**
 * Try-On Engine - 高质量模式策略
 * 
 * 使用 aitryon-plus，最佳效果
 */

const { STRATEGY_NAMES } = require('./types');
const { getRouter } = require('../router');

async function generate(params) {
  const router = getRouter();
  return router.generate(params, STRATEGY_NAMES.QUALITY);
}

module.exports = {
  name: STRATEGY_NAMES.QUALITY,
  generate
};

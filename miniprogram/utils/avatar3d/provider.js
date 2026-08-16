/* 数字人生成统一入口：按 kind 选择生成器。第一版仅免费参数化；AI 仿真版后续并行接入。 */
const buildModel = require("./build-model");

const GENERATORS = {
  free: buildModel
};

async function generate(profile, options) {
  const kind = (options && options.kind) || "free";
  const fn = GENERATORS[kind];
  if (!fn) throw new Error("avatar generator not implemented: " + kind);
  return fn(profile);
}

module.exports = { generate };

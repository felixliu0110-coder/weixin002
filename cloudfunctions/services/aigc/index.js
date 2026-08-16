const mock = require("./mock");
const jimeng = require("./jimeng");

function getAigc() {
  return jimeng.isConfigured() ? jimeng : mock;
}

module.exports = { getAigc };

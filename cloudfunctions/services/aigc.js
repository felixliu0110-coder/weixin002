const mock = require("./aigc-mock");
const agnes = require("./aigc-agnes");

function getAigc() {
  return agnes.isConfigured() ? agnes : mock;
}

module.exports = { getAigc };

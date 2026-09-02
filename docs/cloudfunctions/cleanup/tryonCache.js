// 兼容层：原 cleanup 通过 ./tryonCache 引用，统一指向共享 services/tryonCache
module.exports = require("../services/tryonCache");

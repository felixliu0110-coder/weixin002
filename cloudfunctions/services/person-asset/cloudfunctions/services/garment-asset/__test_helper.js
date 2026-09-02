// 测试辅助：极简模拟微信云开发数据库链式 API
// 仅覆盖 garment-asset repository 用到的：collection / doc / where / limit / orderBy / get / add / update / remove / count
const { EventEmitter } = require('events');

function makeFakeDB(seed = { garments: {}, garment_profiles: {} }) {
  const store = {
    garments: { ...seed.garments },
    garment_profiles: { ...seed.garment_profiles }
  };
  function collection(name) {
    const coll = { _name: name, _where: null, _limit: 50, _order: null };
    coll.where = function (cond) { coll._where = cond; return coll; };
    coll.limit = function (n) { coll._limit = n; return coll; };
    coll.orderBy = function (field, dir) { coll._order = { field, dir }; return coll; };
    coll.doc = function (id) {
      return {
        get: async () => ({ data: store[name] && store[name][id] || null }),
        update: async ({ data }) => {
          if (!store[name][id]) throw new Error('NOT_FOUND');
          store[name][id] = { ...store[name][id], ...data };
          return { stats: { updated: 1 } };
        },
        remove: async () => { delete store[name][id]; return { stats: { removed: 1 } }; }
      };
    };
    coll.get = async () => {
      let rows = Object.values(store[name] || {});
      if (coll._where) {
        rows = rows.filter(r => Object.keys(coll._where).every(k => r[k] === coll._where[k]));
      }
      if (coll._order) {
        const { field, dir } = coll._order;
        rows = rows.slice().sort((a, b) => (a[field] || 0) < (b[field] || 0) ? (dir === 'asc' ? -1 : 1) : (a[field] || 0) > (b[field] || 0) ? (dir === 'asc' ? 1 : -1) : 0);
      }
      return { data: rows.slice(0, coll._limit) };
    };
    coll.add = async ({ data }) => {
      const id = 'p_' + Math.random().toString(36).slice(2, 9);
      store[name][id] = { _id: id, ...data };
      return { _id: id, stats: { added: 1 } };
    };
    coll.count = async () => ({ total: Object.values(store[name] || {}).length });
    return coll;
  }
  return { collection, _store: store };
}

// 断言工具
function assert(cond, msg) { if (!cond) throw new Error('Assertion failed: ' + msg); }
function assertEq(a, b, msg) { if (a !== b) throw new Error('Assertion failed: ' + msg + ' (got ' + JSON.stringify(a) + ', expected ' + JSON.stringify(b) + ')'); }

module.exports = { makeFakeDB, assert, assertEq };

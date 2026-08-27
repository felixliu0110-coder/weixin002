// getOrCreate.test.js
const { assert, assertEq, makeFakeDB } = require('./__test_helper');
const { GarmentAssetService } = require('./index');
const { ASSET_STATUS, PROFILE_SOURCE } = require('./types');

let passed = 0, failed = 0;
function test(name, fn) { try { fn(); console.log('  ✓', name); passed++; } catch (e) { console.error('  ✗', name, '\n    ', e.message); failed++; } }

console.log('getOrCreate.test.js');
function svcWith(garments) { const db = makeFakeDB({ garments }); return new GarmentAssetService(db); }

test('getOrCreate：garments 不存在 → NOT_FOUND', async () => {
  const svc = svcWith({}); let err; try { await svc.getOrCreateGarmentProfile('nope', 'u1'); } catch (e) { err = e; } assert(err && /GARMENT_NOT_FOUND/.test(err.message));
});
test('getOrCreate：ownership 不符 → FORBIDDEN', async () => {
  const svc = svcWith({ gx: { _id: 'gx', user_id: 'other', category: 'tops', status: ASSET_STATUS.READY } });
  let err; try { await svc.getOrCreateGarmentProfile('gx', 'u1'); } catch (e) { err = e; } assert(err && /FORBIDDEN/.test(err.message));
});
test('getOrCreate：builtin → FORBIDDEN', async () => {
  const svc = svcWith({ gb: { _id: 'gb', user_id: 'u1', category: 'dress', type: 'builtin', status: ASSET_STATUS.READY } });
  let err; try { await svc.getOrCreateGarmentProfile('gb', 'u1'); } catch (e) { err = e; } assert(err && /FORBIDDEN/.test(err.message));
});
test('getOrCreate：status!=ready → INVALID_ARGUMENT', async () => {
  const svc = svcWith({ gp: { _id: 'gp', user_id: 'u1', category: 'shoes', status: ASSET_STATUS.PROCESSING } });
  let err; try { await svc.getOrCreateGarmentProfile('gp', 'u1'); } catch (e) { err = e; } assert(err && /INVALID_ARGUMENT/.test(err.message));
});
test('getOrCreate：新建时 category 从 garments.category 初始化，source=manual/status=ready', async () => {
  const svc = svcWith({ g1: { _id: 'g1', user_id: 'u1', category: 'bottoms', status: ASSET_STATUS.READY } });
  const r = await svc.getOrCreateGarmentProfile('g1', 'u1'); assert(r.ok); assertEq(r.profile.category, 'bottoms'); assertEq(r.profile.source, PROFILE_SOURCE.MANUAL); assertEq(r.profile.status, ASSET_STATUS.READY);
});
test('getOrCreate：已有 profile 不重复创建（返回同一 _id）', async () => {
  const svc = svcWith({ g1: { _id: 'g1', user_id: 'u1', category: 'tops', status: ASSET_STATUS.READY } });
  const a = await svc.getOrCreateGarmentProfile('g1', 'u1'); const b = await svc.getOrCreateGarmentProfile('g1', 'u1'); assertEq(a.profile._id, b.profile._id);
});
test('getOrCreate：不返回未经 profile 创建流程的 garments 对象', async () => {
  const svc = svcWith({ g1: { _id: 'g1', user_id: 'u1', category: 'tops', status: ASSET_STATUS.READY, name: 'T恤' } });
  const r = await svc.getOrCreateGarmentProfile('g1', 'u1'); assertEq(r.profile.name, undefined); assertEq(r.profile._id !== 'g1', true);
});
console.log('getOrCreate.test.js done  passed=' + passed + ' failed=' + failed);
process.exit(failed === 0 ? 0 : 1);

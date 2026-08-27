// repository.test.js
const { assert, assertEq, makeFakeDB } = require('./__test_helper');
const GarmentAssetRepository = require('./repository');
const { ASSET_STATUS, PROFILE_SOURCE } = require('./types');

let passed = 0, failed = 0;
function test(name, fn) { try { fn(); console.log('  ✓', name); passed++; } catch (e) { console.error('  ✗', name, '\n    ', e.message); failed++; } }

console.log('repository.test.js');
function seedDB() {
  const db = makeFakeDB({
    garments: {
      g1: { _id: 'g1', user_id: 'u1', category: 'tops', status: ASSET_STATUS.READY },
      g_other: { _id: 'g_other', user_id: 'other', category: 'bottoms', status: ASSET_STATUS.READY },
      g_builtin: { _id: 'g_builtin', user_id: 'u1', category: 'dress', type: 'builtin', status: ASSET_STATUS.READY },
      g_proc: { _id: 'g_proc', user_id: 'u1', category: 'shoes', status: ASSET_STATUS.PROCESSING }
    }
  });
  return new GarmentAssetRepository(db);
}

test('ownership 失败：其它用户的 garments 在 getOrCreate 时报 FORBIDDEN', async () => {
  const repo = seedDB();
  let err; try { await repo.getOrCreateByGarmentId('g_other', 'u1'); } catch (e) { err = e; }
  assert(err && /FORBIDDEN/.test(err.message));
});
test('builtin 禁止：type=builtin 报 FORBIDDEN', async () => {
  const repo = seedDB();
  let err; try { await repo.getOrCreateByGarmentId('g_builtin', 'u1'); } catch (e) { err = e; }
  assert(err && /FORBIDDEN/.test(err.message));
});
test('非 ready 禁止：status!=ready 报 INVALID_ARGUMENT', async () => {
  const repo = seedDB();
  let err; try { await repo.getOrCreateByGarmentId('g_proc', 'u1'); } catch (e) { err = e; }
  assert(err && /INVALID_ARGUMENT/.test(err.message));
});
test('已有 profile 不重复创建（lazy create 复用）', async () => {
  const repo = seedDB();
  const a = await repo.getOrCreateByGarmentId('g1', 'u1');
  const b = await repo.getOrCreateByGarmentId('g1', 'u1');
  assertEq(a._id, b._id);
});
test('lazy create 从 garments.category 初始化，source=manual/status=ready', async () => {
  const repo = seedDB();
  const p = await repo.getOrCreateByGarmentId('g1', 'u1');
  assertEq(p.category, 'tops'); assertEq(p.source, PROFILE_SOURCE.MANUAL); assertEq(p.status, ASSET_STATUS.READY);
});
test('profile 更新只能作用于当前用户（归属不符返回 NOT_FOUND）', async () => {
  const repo = seedDB();
  const created = await repo.getOrCreateByGarmentId('g1', 'u1');
  let err; try { await repo.update(created._id, 'other_user', { category: 'shoes' }); } catch (e) { err = e; }
  assert(err && /GARMENT_PROFILE_NOT_FOUND/.test(err.message));
});
test('profile 删除只能作用于当前用户', async () => {
  const repo = seedDB();
  const created = await repo.getOrCreateByGarmentId('g1', 'u1');
  let err; try { await repo.delete(created._id, 'other_user'); } catch (e) { err = e; }
  assert(err && /GARMENT_PROFILE_NOT_FOUND/.test(err.message));
  const ok = await repo.delete(created._id, 'u1'); assertEq(ok, true);
});
test('listByUserId 仅返回当前用户数据', async () => {
  const repo = seedDB();
  await repo.getOrCreateByGarmentId('g1', 'u1');
  const list = await repo.listByUserId('u1'); assertEq(list.length, 1); assertEq(list[0].user_id, 'u1');
});
console.log('repository.test.js done  passed=' + passed + ' failed=' + failed);
process.exit(failed === 0 ? 0 : 1);

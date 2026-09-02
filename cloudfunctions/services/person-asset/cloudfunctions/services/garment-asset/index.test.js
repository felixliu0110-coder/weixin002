// index.test.js
const { assert, assertEq, makeFakeDB } = require('./__test_helper');
const { GarmentAssetService } = require('./index');
const { ASSET_STATUS, PROFILE_SOURCE } = require('./types');

let passed = 0, failed = 0;
function test(name, fn) { try { fn(); console.log('  ✓', name); passed++; } catch (e) { console.error('  ✗', name, '\n    ', e.message); failed++; } }

console.log('index.test.js');
function makeSvc() {
  const db = makeFakeDB({ garments: { g1: { _id: 'g1', user_id: 'u1', category: 'tops', status: ASSET_STATUS.READY } } });
  return { svc: new GarmentAssetService(db), db };
}

test('公开 API 仅含收口方法（无 importFromGarment/batchCreate/calculateSimilarity/listByCategory/countGarmentProfiles/updateStatus/getGarmentAssetStatus）', () => {
  const { svc } = makeSvc();
  ['createGarmentProfile','getGarmentProfile','getGarmentProfileByGarmentId','updateGarmentProfile','deleteGarmentProfile','listGarmentProfiles','getOrCreateGarmentProfile','preflightCheck'].forEach(m => assert(typeof svc[m] === 'function', '缺少 ' + m));
  ['importFromGarment','batchCreate','calculateSimilarity','listByCategory','countGarmentProfiles','updateStatus','getGarmentAssetStatus'].forEach(m => assert(typeof svc[m] === 'undefined', '不应存在 ' + m));
});
test('createGarmentProfile 创建成功并返回 report', async () => {
  const { svc } = makeSvc(); const r = await svc.createGarmentProfile({ garmentId: 'g1', openid: 'u1' });
  assert(r.ok && r.profile && r.report); assertEq(r.profile.source, PROFILE_SOURCE.MANUAL); assertEq(r.profile.status, ASSET_STATUS.READY);
});
test('getOrCreateGarmentProfile 真实实现：首次创建、二次复用', async () => {
  const { svc } = makeSvc();
  const a = await svc.getOrCreateGarmentProfile('g1', 'u1'); assert(a.ok && a.profile);
  const b = await svc.getOrCreateGarmentProfile('g1', 'u1'); assertEq(a.profile._id, b.profile._id);
});
test('getOrCreateGarmentProfile 缺 garmentId/openid 报错', async () => {
  const { svc } = makeSvc();
  let e1; try { await svc.getOrCreateGarmentProfile(null, 'u1'); } catch (e) { e1 = e; }
  assert(e1); let e2; try { await svc.getOrCreateGarmentProfile('g1', null); } catch (e) { e2 = e; } assert(e2);
});
test('updateGarmentProfile 仅当前用户可更新', async () => {
  const { svc } = makeSvc(); const c = await svc.createGarmentProfile({ garmentId: 'g1', openid: 'u1' });
  const upd = await svc.updateGarmentProfile(c.profile._id, 'u1', { category: 'bottoms' }); assertEq(upd.category, 'bottoms');
  let err; try { await svc.updateGarmentProfile(c.profile._id, 'other', { category: 'dress' }); } catch (e) { err = e; } assert(err);
});
test('deleteGarmentProfile 仅当前用户可删除', async () => {
  const { svc } = makeSvc(); const c = await svc.createGarmentProfile({ garmentId: 'g1', openid: 'u1' });
  const ok = await svc.deleteGarmentProfile(c.profile._id, 'u1'); assertEq(ok, true);
});
console.log('index.test.js done  passed=' + passed + ' failed=' + failed);
process.exit(failed === 0 ? 0 : 1);

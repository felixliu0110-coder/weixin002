// types.test.js
const { assert, assertEq } = require('./__test_helper');
const { validateGarmentProfile, createDefaultDoc, mapFromGarment, ASSET_STATUS, PROFILE_SOURCE } = require('./types');

let passed = 0, failed = 0;
function test(name, fn) { try { fn(); console.log('  ✓', name); passed++; } catch (e) { console.error('  ✗', name, '\n    ', e.message); failed++; } }

console.log('types.test.js');
test('mapFromGarment 不含越界字段（name/size_label/measurements/original_file_id/type）', () => {
  const g = { _id: 'g1', user_id: 'u1', category: 'tops', name: 'T恤', size_label: 'M', measurements: { lengthCm: 65 }, original_file_id: 'cloud://x', type: 'upload' };
  const p = mapFromGarment(g);
  assertEq(p.garment_id, 'g1');
  assertEq(p.user_id, 'u1');
  assertEq(p.category, 'tops');
  assertEq(p.name, undefined);
  assertEq(p.size_label, undefined);
  assertEq(p.measurements, undefined);
  assertEq(p.original_file_id, undefined);
  assertEq(p.type, undefined);
});
test('mapFromGarment 仅映射允许的关联/初始化字段', () => {
  const p = mapFromGarment({ _id: 'g2', user_id: 'u2', category: 'bottoms' });
  assertEq(p.garment_id, 'g2'); assertEq(p.user_id, 'u2'); assertEq(p.category, 'bottoms');
  assertEq(p.source, PROFILE_SOURCE.MANUAL); assertEq(p.status, ASSET_STATUS.READY);
});
test('createDefaultDoc 正确（source=manual, status=ready）', () => {
  const d = createDefaultDoc('g3', 'u3', { category: 'dress' });
  assertEq(d.garment_id, 'g3'); assertEq(d.user_id, 'u3'); assertEq(d.category, 'dress');
  assertEq(d.source, PROFILE_SOURCE.MANUAL); assertEq(d.status, ASSET_STATUS.READY);
  assert(Array.isArray(d.color) && d.color.length === 0);
  assert(Array.isArray(d.season) && d.season.length === 0);
});
test('validateGarmentProfile 缺 garment_id 失败', () => {
  const r = validateGarmentProfile({ user_id: 'u' }); assert(!r.valid); assert(r.errors.some(e => e.includes('garment_id')));
});
test('validateGarmentProfile 缺 user_id 失败', () => {
  const r = validateGarmentProfile({ garment_id: 'g' }); assert(!r.valid); assert(r.errors.some(e => e.includes('user_id')));
});
test('validateGarmentProfile 拒绝越界字段 name/size_label/measurements/original_file_id/type', () => {
  const r = validateGarmentProfile({ garment_id: 'g', user_id: 'u', name: 'x', size_label: 'M', measurements: {}, original_file_id: 'c', type: 'upload' });
  assert(!r.valid); assert(r.errors.some(e => e.includes('name'))); assert(r.errors.some(e => e.includes('type')));
});
test('validateGarmentProfile 合法文档通过', () => {
  const r = validateGarmentProfile({ garment_id: 'g', user_id: 'u', category: 'tops' }); assert(r.valid);
});
console.log('types.test.js done  passed=' + passed + ' failed=' + failed);
process.exit(failed === 0 ? 0 : 1);

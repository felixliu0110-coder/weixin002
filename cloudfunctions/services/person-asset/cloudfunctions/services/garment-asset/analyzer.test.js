// analyzer.test.js
const { assert, assertEq } = require('./__test_helper');
const GarmentAssetAnalyzer = require('./analyzer');

let passed = 0, failed = 0;
function test(name, fn) { try { fn(); console.log('  ✓', name); passed++; } catch (e) { console.error('  ✗', name, '\n    ', e.message); failed++; } }

console.log('analyzer.test.js');
const a = new GarmentAssetAnalyzer();
test('generateReport 仅读取已有字段，不推断新属性', () => {
  const p = { _id: 'p1', user_id: 'u1', garment_id: 'g1', category: 'tops', color: ['white'], style: 'casual', pattern: 'solid', occasion: ['daily'], season: ['summer'] };
  const r = a.generateReport(p);
  assertEq(r.profileId, 'p1'); assertEq(r.analysis.category, 'tops'); assertEq(r.analysis.styles[0], 'casual');
  assert(Array.isArray(r.analysis.colors)); assertEq(r.analysis.colors[0], 'white');
});
test('generateReport 对 null profile 安全返回', () => {
  const r = a.generateReport(null); assertEq(r.analysis, null); assert(Array.isArray(r.recommendations));
});
test('preflightCheck：有 category 则 isValid=true', () => {
  const r = a.preflightCheck({ category: 'tops' }); assertEq(r.isValid, true); assertEq(r.hasCategory, true);
});
test('preflightCheck：无 category 则 isValid=false 并给警告', () => {
  const r = a.preflightCheck({}); assertEq(r.isValid, false); assertEq(r.hasCategory, false); assert(r.warnings.length > 0);
});
test('preflightCheck：null profile 安全返回', () => {
  const r = a.preflightCheck(null); assertEq(r.isValid, false); assert(r.warnings.some(w => /不存在/.test(w)));
});
console.log('analyzer.test.js done  passed=' + passed + ' failed=' + failed);
process.exit(failed === 0 ? 0 : 1);

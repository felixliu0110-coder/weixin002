const { test } = require('node:test');
const assert = require('node:assert');
const { toTryOnCategory, normalizeGarmentCategory, ERROR_UNSUPPORTED, TRYON_CATEGORY } = require('./category');

test('上衣 -> tops', () => {
  assert.strictEqual(toTryOnCategory('上衣'), TRYON_CATEGORY.TOPS);
});

test('裤子 -> bottoms', () => {
  assert.strictEqual(toTryOnCategory('裤子'), TRYON_CATEGORY.BOTTOMS);
});

test('头饰 -> UNSUPPORTED_TRYON_CATEGORY', () => {
  assert.strictEqual(toTryOnCategory('头饰'), ERROR_UNSUPPORTED);
});

test('鞋子 -> UNSUPPORTED_TRYON_CATEGORY', () => {
  assert.strictEqual(toTryOnCategory('鞋子'), ERROR_UNSUPPORTED);
});

test('其他 -> UNSUPPORTED_TRYON_CATEGORY', () => {
  assert.strictEqual(toTryOnCategory('其他'), ERROR_UNSUPPORTED);
});

test('null/undefined 返回 UNSUPPORTED', () => {
  assert.strictEqual(toTryOnCategory(null), ERROR_UNSUPPORTED);
  assert.strictEqual(toTryOnCategory(undefined), ERROR_UNSUPPORTED);
});

test('normalizeGarmentCategory 保留 sourceCategory 并标准化 category', () => {
  const g = normalizeGarmentCategory({ garmentId: 'g1', category: '上衣', name: '白T' });
  assert.strictEqual(g.sourceCategory, '上衣');
  assert.strictEqual(g.category, 'tops');
  assert.strictEqual(g.garmentId, 'g1');
});

test('normalizeGarmentCategory：不支持品类 category 标为 ERROR_UNSUPPORTED', () => {
  const g = normalizeGarmentCategory({ category: '头饰' });
  assert.strictEqual(g.category, ERROR_UNSUPPORTED); // 明确标记不支持
  assert.strictEqual(g.sourceCategory, '头饰'); // 原始枚举保留
});

test('连衣裙预留 -> dress', () => {
  assert.strictEqual(toTryOnCategory('连衣裙'), 'dress');
});

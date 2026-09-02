const { test } = require('node:test');
const assert = require('node:assert');
const { normalizeContext, validateContext, normalizePerson, normalizeGarments } = require('./context');
const { ERROR_UNSUPPORTED } = require('./category');

test('originalPhoto 优先作为人物主图', () => {
  const ctx = normalizeContext({
    person: { originalPhoto: 'orig', frontPhoto: 'front', anchorImage: 'anchor', bodyProfile: { heightCm: 165 } },
    garments: [{ image: 'g1', category: '上衣' }],
  });
  assert.strictEqual(ctx.person.personImage, 'orig');
  assert.strictEqual(ctx.person.personSourceType, 'original_photo');
  assert.deepStrictEqual(ctx.person.bodyProfile, { heightCm: 165 });
});

test('frontPhoto fallback 当 originalPhoto 缺失', () => {
  const ctx = normalizeContext({
    person: { frontPhoto: 'front', anchorImage: 'anchor' },
    garments: [{ image: 'g1', category: '上衣' }],
  });
  assert.strictEqual(ctx.person.personImage, 'front');
  assert.strictEqual(ctx.person.personSourceType, 'front_photo');
});

test('anchorImage fallback 当 original/front 均缺失', () => {
  const ctx = normalizeContext({
    person: { anchorImage: 'anchor' },
    garments: [{ image: 'g1', category: '上衣' }],
  });
  assert.strictEqual(ctx.person.personImage, 'anchor');
  assert.strictEqual(ctx.person.personSourceType, 'anchor_image');
});

test('composite / three_view_composite 不作为默认人物输入', () => {
  const ctx = normalizeContext({
    person: { anchorImage: 'anchor', personImage: 'should_not_use_composite' },
    garments: [{ image: 'g1', category: '上衣' }],
  });
  // 只识别 originalPhoto/frontPhoto/anchorImage 三档，personImage 不被当作主图来源
  assert.strictEqual(ctx.person.personImage, 'anchor');
});

test('bodyProfile 不存在时不伪造', () => {
  const ctx = normalizeContext({
    person: { originalPhoto: 'orig' },
    garments: [{ image: 'g1', category: '上衣' }],
  });
  assert.strictEqual(ctx.person.bodyProfile, null);
  assert.strictEqual(ctx.person.personImage, 'orig');
});

test('多件 garment 可规范化且中文 category 转换', () => {
  const ctx = normalizeContext({
    person: { originalPhoto: 'orig' },
    garments: [
      { garmentId: 'g1', image: 'u1', category: '上衣', name: '白T' },
      { garmentId: 'g2', image: 'u2', category: '裤子', name: '牛仔裤' },
    ],
  });
  assert.strictEqual(ctx.garments.length, 2);
  assert.strictEqual(ctx.garments[0].category, 'tops');
  assert.strictEqual(ctx.garments[0].sourceCategory, '上衣');
  assert.strictEqual(ctx.garments[0].name, '白T');
  assert.strictEqual(ctx.garments[1].category, 'bottoms');
  assert.strictEqual(ctx.garments[1].sourceCategory, '裤子');
});

test('中文 category 正确转换为内部枚举', () => {
  const ctx = normalizeContext({
    person: { originalPhoto: 'orig' },
    garments: [{ image: 'g', category: '上衣' }],
  });
  assert.strictEqual(ctx.garments[0].category, 'tops');
  assert.strictEqual(ctx.garments[0].sourceCategory, '上衣');
});

test('不支持品类在 validate 中报错', () => {
  const ctx = normalizeContext({
    person: { originalPhoto: 'orig' },
    garments: [{ image: 'g', category: '头饰' }],
  });
  assert.strictEqual(ctx.garments[0].category, ERROR_UNSUPPORTED);
  const v = validateContext(ctx);
  assert.strictEqual(v.valid, false);
  assert.ok(v.errors.some((e) => e.includes('支持试穿')));
});

test('旧参数兼容：personImage/garmentImage/category 转换为标准 Context', () => {
  const ctx = normalizeContext({ personImage: 'p', garmentImage: 'g', category: '上衣' });
  assert.strictEqual(ctx.person.personImage, 'p');
  assert.strictEqual(ctx.garments.length, 1);
  assert.strictEqual(ctx.garments[0].category, 'tops');
});

test('validateContext：person 缺失报错', () => {
  const ctx = normalizeContext({ person: {}, garments: [{ image: 'g', category: '上衣' }] });
  const v = validateContext(ctx);
  assert.strictEqual(v.valid, false);
});

test('normalizePerson 无参数返回 _empty', () => {
  const p = normalizePerson(null);
  assert.strictEqual(p._empty, true);
});

test('options 默认值', () => {
  const ctx = normalizeContext({
    person: { originalPhoto: 'orig' },
    garments: [{ image: 'g', category: '上衣' }],
  });
  assert.strictEqual(ctx.options.mode, 'image');
  assert.strictEqual(ctx.options.preserveFace, true);
  assert.strictEqual(ctx.options.background, 'keep');
});

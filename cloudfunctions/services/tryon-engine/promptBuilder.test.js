const { test } = require('node:test');
const assert = require('node:assert');
const { build, resolvePersonSourceType } = require('./promptBuilder');

test('不出现写死的 170cm/60kg', () => {
  const { prompt } = build({
    person: { originalPhoto: 'p', bodyProfile: { heightCm: 170, weightKg: 60 } },
    garments: [{ image: 'g', category: 'tops', name: '白T' }],
  });
  assert.strictEqual(prompt.includes('170cm'), false, '不应出现写死的 170cm');
  assert.strictEqual(prompt.includes('60kg'), false, '不应出现写死的 60kg');
});

test('使用真实 bodyProfile 时以约束形式体现', () => {
  const { prompt, constraints } = build({
    person: { originalPhoto: 'p', bodyProfile: { heightCm: 165, weightKg: 55 } },
    garments: [{ image: 'g', category: 'tops' }],
  });
  assert.ok(prompt.includes('165') && prompt.includes('55'), '真实 bodyProfile 应被引用');
  assert.ok(constraints.some((c) => c.includes('真实身体参数')));
});

test('bodyProfile 不存在时不伪造身体数据', () => {
  const { prompt, meta } = build({
    person: { originalPhoto: 'p' },
    garments: [{ image: 'g', category: 'tops' }],
  });
  assert.strictEqual(prompt.includes('cm'), false);
  assert.strictEqual(prompt.includes('kg'), false);
  assert.strictEqual(meta.hasBodyProfile, false);
});

test('使用 garment image 作为主要服装依据', () => {
  const { prompt } = build({
    person: { originalPhoto: 'p' },
    garments: [{ image: 'g', category: 'tops' }],
  });
  assert.ok(prompt.includes('服装图片为主要服装依据'));
});

test('默认保持人物身份', () => {
  const { prompt, constraints } = build({
    person: { originalPhoto: 'p' },
    garments: [{ image: 'g', category: 'tops' }],
  });
  assert.ok(prompt.includes('不改变人物身份'));
  assert.ok(constraints.some((c) => c.includes('保持人物面部特征')));
});

test('默认不强制改变原背景', () => {
  const { prompt, constraints } = build({
    person: { originalPhoto: 'p' },
    garments: [{ image: 'g', category: 'tops' }],
  });
  assert.ok(prompt.includes('不改变背景') || prompt.includes('保持人物原图场景'));
  assert.ok(constraints.some((c) => c.includes('不改变背景') || c.includes('保持人物原图场景')));
});

test('options.background 非 keep 时调整场景', () => {
  const { prompt, constraints } = build({
    person: { originalPhoto: 'p' },
    garments: [{ image: 'g', category: 'bottoms' }],
    options: { background: 'studio' },
  });
  assert.ok(constraints.some((c) => c.includes('studio')));
});

test('resolvePersonSourceType：original > front > anchor', () => {
  assert.strictEqual(resolvePersonSourceType({ originalPhoto: 'p' }), 'original_photo');
  assert.strictEqual(resolvePersonSourceType({ frontPhoto: 'f' }), 'front_photo');
  assert.strictEqual(resolvePersonSourceType({ anchorImage: 'a' }), 'anchor_image');
  assert.strictEqual(resolvePersonSourceType({}), undefined);
});

test('不支持品类（头饰）不进入生成依据', () => {
  const { meta } = build({
    person: { originalPhoto: 'p' },
    garments: [{ image: 'g', category: '头饰' }],
  });
  assert.strictEqual(meta.garmentCount, 0);
});

test('多件 garment 计数且仅有效品类计入', () => {
  const { meta } = build({
    person: { originalPhoto: 'p' },
    garments: [
      { image: 'g1', category: 'tops' },
      { image: 'g2', category: 'bottoms' },
      { image: 'g3', category: '头饰' },
    ],
  });
  assert.strictEqual(meta.garmentCount, 2);
});

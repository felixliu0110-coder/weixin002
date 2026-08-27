const { test } = require('node:test');
const assert = require('node:assert');
const {
  generate, getStatus, getAvailableProviders, _normalizeContext, _validateContext,
} = require('./index');
const { ERROR_UNSUPPORTED } = require('./category');

// 环境无 AGNES/ALIYUN key 时仅 mock 可用；通过 status 验证路由可用
test('engine：旧参数兼容 + mock 生成成功', async () => {
  const res = await generate({
    personImage: 'https://example.com/p.png',
    garmentImage: 'https://example.com/g.png',
    category: '上衣',
  }, 'BALANCED');
  assert.strictEqual(res.ok, true, `expected ok=true, got ${JSON.stringify(res)}`);
  assert.ok(res.provider, '应有 provider 字段');
});

test('engine：标准 Context 输入 tops 成功', async () => {
  const res = await generate({
    person: { originalPhoto: 'https://example.com/p.png' },
    garments: [{ garmentId: 'g1', image: 'https://example.com/g.png', category: '上衣', name: '白T' }],
    options: { mode: 'image', preserveFace: true },
  }, 'BALANCED');
  assert.strictEqual(res.ok, true, JSON.stringify(res));
});

test('engine：不支持品类返回 UNSUPPORTED_TRYON_CATEGORY', async () => {
  const res = await generate({
    person: { originalPhoto: 'https://example.com/p.png' },
    garments: [{ image: 'https://example.com/g.png', category: '头饰' }],
  }, 'BALANCED');
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.errorCode, 'UNSUPPORTED_TRYON_CATEGORY');
});

test('engine：person 缺失返回 INVALID_TRYON_CONTEXT', async () => {
  const res = await generate({
    person: {},
    garments: [{ image: 'https://example.com/g.png', category: '上衣' }],
  }, 'BALANCED');
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.errorCode, 'INVALID_TRYON_CONTEXT');
});

test('engine：metadata 记录 personSourceType=original_photo', async () => {
  const res = await generate({
    person: { originalPhoto: 'https://example.com/p.png' },
    garments: [{ image: 'https://example.com/g.png', category: '裤子' }],
  }, 'BALANCED');
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.metadata && res.metadata.personSourceType, 'original_photo');
});

test('getStatus / getAvailableProviders 不抛错', () => {
  const st = getStatus();
  assert.ok(st && Array.isArray(st.providers));
  const av = getAvailableProviders();
  assert.ok(Array.isArray(av));
});

test('normalizeContext 暴露函数可用', () => {
  const ctx = _normalizeContext({ personImage: 'p', garmentImage: 'g', category: '上衣' });
  assert.strictEqual(ctx.person.personImage, 'p');
  assert.strictEqual(ctx.garments[0].category, 'tops');
});

test('validateContext 暴露函数：无 garment 报错', () => {
  const ctx = _normalizeContext({ person: { originalPhoto: 'p' }, garments: [] });
  const v = _validateContext(ctx);
  assert.strictEqual(v.valid, false);
});

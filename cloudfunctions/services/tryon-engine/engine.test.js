const { test } = require('node:test');
const assert = require('node:assert');
const {
  generate, getStatus, getAvailableProviders, _normalizeContext, _validateContext,
} = require('./index');
const { getRouter } = require('./router');
const { ERROR_UNSUPPORTED } = require('./category');

// =====================================================================
// Phase 4.3-A 测试约定：
//   本环境无 AGNES / ALIYUN 真实 API Key，因此 Agnes / Aliyun 均 isConfigured()=false。
//   按 P0-5，Router 不得把 Mock 当作生产自动兜底 → 经 index.generate() 的真实链路
//   在没有真实 Provider 时应「明确失败」，绝不返回 ok:true 的占位成功。
//   Mock Provider 只通过「显式直接调用」来测试（见下方「Mock 显式测试」区块）。
// =====================================================================

// ---------- 工具：构造一个通过校验的标准 Context ----------
function makeCtx(overrides = {}) {
  return {
    person: { originalPhoto: 'https://example.com/p.png', personImage: 'https://example.com/p.png', personSourceType: 'original_photo' },
    garments: [{ garmentId: 'g1', image: 'https://example.com/g.png', category: 'tops', sourceCategory: '上衣', name: '白T' }],
    options: { mode: 'image', preserveFace: true },
    ...overrides,
  };
}

// ============================================================
// 区块 1：经 index.generate() 的真实链路 —— 无真实 Provider 时必须明确失败（P0-5）
// ============================================================
test('engine：无真实 Provider 时不会以 Mock 伪造成功', async () => {
  // 环境无 AGNES/ALIYUN key → 所有真实 Provider 均不可用。
  // 真实链路必须返回 ok:false，绝不能 ok:true。
  const res = await generate(makeCtx(), 'BALANCED');
  assert.strictEqual(res.ok, false, `不应伪成功，实际：${JSON.stringify(res)}`);
  assert.ok(res.error, '应携带错误信息');
});

test('engine：FAILOVER 无真实 Provider 时同样明确失败（不 mock 兜底）', async () => {
  const res = await generate(makeCtx(), 'FAILOVER');
  assert.strictEqual(res.ok, false);
});

test('engine：旧参数兼容路径在无真实 Provider 时也不伪成功', async () => {
  const res = await generate({
    personImage: 'https://example.com/p.png',
    garmentImage: 'https://example.com/g.png',
    category: '上衣',
  }, 'BALANCED');
  assert.strictEqual(res.ok, false);
});

// ============================================================
// 区块 2：Mock 显式测试 —— Mock 仍可被直接调用并产生成功（P0-5）
//   注：不通过 index.generate() 的自动路由，而是显式取 mock provider。
// ============================================================
test('Mock Provider 显式调用：仍可成功返回统一响应格式', async () => {
  const router = getRouter();
  const mock = router.providers.get('mock');
  assert.ok(mock, '应已注册 mock provider');
  assert.strictEqual(mock.isConfigured(), true, 'Mock 始终可用');

  const res = await mock.generate(makeCtx());
  assert.strictEqual(res.ok, true, `mock 应成功，实际：${JSON.stringify(res)}`);
  assert.ok(res.imageUrl, '应有 imageUrl');
  assert.strictEqual(res.provider, 'mock');
});

test('Mock 显式调用：使用标准 Context（person.personImage / garments[0]）', async () => {
  const router = getRouter();
  const mock = router.providers.get('mock');
  // 标准 Context（originalPhoto + personImage 并存，personImage 为最终决定）
  const ctx = makeCtx({
    person: { originalPhoto: 'A', frontPhoto: 'B', anchorImage: 'C', personImage: 'A' },
  });
  const res = await mock.generate(ctx);
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.provider, 'mock');
});

// ============================================================
// 区块 3：Engine 校验 / 错误码（不依赖真实 Provider，在到达 Router 前返回）
// ============================================================
test('engine：不支持品类返回 UNSUPPORTED_TRYON_CATEGORY（头饰）', async () => {
  const res = await generate({
    person: { originalPhoto: 'https://example.com/p.png', personImage: 'https://example.com/p.png' },
    garments: [{ image: 'https://example.com/g.png', category: '头饰' }],
  }, 'BALANCED');
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.errorCode, 'UNSUPPORTED_TRYON_CATEGORY');
});

test('engine：dress 当前生产不支持（UNSUPPORTED_TRYON_CATEGORY，P0-4）', async () => {
  const res = await generate({
    person: { originalPhoto: 'https://example.com/p.png', personImage: 'https://example.com/p.png' },
    garments: [{ image: 'https://example.com/g.png', category: 'dress' }],
  }, 'BALANCED');
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.errorCode, 'UNSUPPORTED_TRYON_CATEGORY');
});

test('engine：鞋子返回 UNSUPPORTED_TRYON_CATEGORY', async () => {
  const res = await generate({
    person: { originalPhoto: 'https://example.com/p.png', personImage: 'https://example.com/p.png' },
    garments: [{ image: 'https://example.com/g.png', category: '鞋子' }],
  }, 'BALANCED');
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.errorCode, 'UNSUPPORTED_TRYON_CATEGORY');
});

test('engine：其他返回 UNSUPPORTED_TRYON_CATEGORY', async () => {
  const res = await generate({
    person: { originalPhoto: 'https://example.com/p.png', personImage: 'https://example.com/p.png' },
    garments: [{ image: 'https://example.com/g.png', category: '其他' }],
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

test('engine：多件 garment 明确拒绝且 errorCode = MULTI_GARMENT_NOT_SUPPORTED（P0-3）', async () => {
  const res = await generate({
    person: { originalPhoto: 'https://example.com/p.png', personImage: 'https://example.com/p.png' },
    garments: [
      { image: 'https://example.com/g1.png', category: '上衣' },
      { image: 'https://example.com/g2.png', category: '裤子' },
    ],
  }, 'BALANCED');
  assert.strictEqual(res.ok, false);
  // 【关键契约】多 garment 必须返回精确 errorCode，而非笼统的 INVALID_TRYON_CONTEXT
  assert.strictEqual(res.errorCode, 'MULTI_GARMENT_NOT_SUPPORTED');
  assert.ok(res.error && res.error.includes('一件'), `应提示仅支持一件，实际：${res.error}`);
});

test('engine：0 件 garment 报错且 errorCode = MULTI_GARMENT_NOT_SUPPORTED', async () => {
  const res = await generate({
    person: { originalPhoto: 'https://example.com/p.png', personImage: 'https://example.com/p.png' },
    garments: [],
  }, 'BALANCED');
  assert.strictEqual(res.ok, false);
  // 0 件与 >=2 件同属「不满足恰好一件」，统一为 MULTI_GARMENT_NOT_SUPPORTED
  assert.strictEqual(res.errorCode, 'MULTI_GARMENT_NOT_SUPPORTED');
});

test('engine：metadata 透传 personSourceType（使用 mock 显式调用）', async () => {
  const router = getRouter();
  const mock = router.providers.get('mock');
  const ctx = makeCtx({
    // 注意：person 需携带 Engine 已决定的 personSourceType（模拟真实链路中 context.normalizePerson 的产物）
    person: {
      originalPhoto: 'https://example.com/p.png',
      personImage: 'https://example.com/p.png',
      personSourceType: 'original_photo',
    },
  });
  const res = await mock.generate(ctx);
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.metadata && res.metadata.personSourceType, 'original_photo');
});

test('getStatus / getAvailableProviders 不抛错', () => {
  const st = getStatus();
  assert.ok(st && Array.isArray(st.providers));
  const av = getAvailableProviders();
  assert.ok(Array.isArray(av));
});

test('normalizeContext / validateContext 暴露函数可用', () => {
  const ctx = _normalizeContext({ personImage: 'p', garmentImage: 'g', category: '上衣' });
  assert.strictEqual(ctx.person.personImage, 'p');
  assert.strictEqual(ctx.garments[0].category, 'tops');

  const v = _validateContext(_normalizeContext({ person: { originalPhoto: 'p' }, garments: [] }));
  assert.strictEqual(v.valid, false);
});

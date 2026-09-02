/**
 * AliyunTryOnProvider 单元测试
 *
 * 完全 Mock submitTask / pollTask —— 测试期间绝对不产生真实网络请求。
 */

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const AliyunTryOnProvider = require('./aliyun');

// 禁用真实网络：替换原型方法为抛错桩（若被调用即 fail）
function installNetworkGuard(provider) {
  provider.submitTask = () => { throw new Error('REAL_NETWORK_CALL: submitTask should be mocked'); };
  provider.pollTask = () => { throw new Error('REAL_NETWORK_CALL: pollTask should be mocked'); };
  provider.getRequest = () => { throw new Error('REAL_NETWORK_CALL: getRequest should be mocked'); };
}

function makeCtx({ category = 'tops', personImage = 'PERSON_A', garmentImage = 'GARMENT_X' } = {}) {
  return {
    person: { personImage },
    garments: [{ image: garmentImage, category }],
  };
}

describe('AliyunTryOnProvider category mapping', () => {
  let provider;

  beforeEach(() => {
    provider = new AliyunTryOnProvider('aitryon');
    installNetworkGuard(provider); // 任何未 mock 的网络调用立即失败
  });

  it('1) tops → top_garment_url', async () => {
    let capturedBody = null;
    provider.submitTask = async (body) => { capturedBody = body; return { output: { task_id: 'T1' } }; };
    provider.pollTask = async () => ({ output: { task_status: 'SUCCEEDED', results: [{ url: 'http://r/1' }] } });

    const res = await provider._generateInternal(makeCtx({ category: 'tops' }));

    assert.strictEqual(capturedBody.input.top_garment_url, 'GARMENT_X', 'tops 应使用 top_garment_url');
    assert.strictEqual(res.url, 'http://r/1');
  });

  it('2) bottoms → bottom_garment_url', async () => {
    let capturedBody = null;
    provider.submitTask = async (body) => { capturedBody = body; return { output: { task_id: 'T2' } }; };
    provider.pollTask = async () => ({ output: { task_status: 'SUCCEEDED', results: [{ url: 'http://r/2' }] } });

    const res = await provider._generateInternal(makeCtx({ category: 'bottoms' }));

    assert.strictEqual(capturedBody.input.bottom_garment_url, 'GARMENT_X', 'bottoms 应使用 bottom_garment_url');
    assert.strictEqual(res.url, 'http://r/2');
  });

  it('3) tops 不出现 bottom_garment_url', async () => {
    let capturedBody = null;
    provider.submitTask = async (body) => { capturedBody = body; return { output: { task_id: 'T3' } }; };
    provider.pollTask = async () => ({ output: { task_status: 'SUCCEEDED', results: [{ url: 'r' }] } });

    await provider._generateInternal(makeCtx({ category: 'tops' }));

    assert.strictEqual(capturedBody.input.bottom_garment_url, undefined, 'tops 不应有 bottom_garment_url');
  });

  it('4) bottoms 不出现 top_garment_url', async () => {
    let capturedBody = null;
    provider.submitTask = async (body) => { capturedBody = body; return { output: { task_id: 'T4' } }; };
    provider.pollTask = async () => ({ output: { task_status: 'SUCCEEDED', results: [{ url: 'r' }] } });

    await provider._generateInternal(makeCtx({ category: 'bottoms' }));

    assert.strictEqual(capturedBody.input.top_garment_url, undefined, 'bottoms 不应有 top_garment_url');
  });

  it('5) personImage 必须来自 ctx.person.personImage', async () => {
    let capturedBody = null;
    provider.submitTask = async (body) => { capturedBody = body; return { output: { task_id: 'T5' } }; };
    provider.pollTask = async () => ({ output: { task_status: 'SUCCEEDED', results: [{ url: 'r' }] } });

    await provider._generateInternal(makeCtx({ personImage: 'PERSON_A' }));

    assert.strictEqual(capturedBody.input.person_image_url, 'PERSON_A');
  });

  it('6) garmentImage 必须来自 ctx.garments[0].image', async () => {
    let capturedBody = null;
    provider.submitTask = async (body) => { capturedBody = body; return { output: { task_id: 'T6' } }; };
    provider.pollTask = async () => ({ output: { task_status: 'SUCCEEDED', results: [{ url: 'r' }] } });

    await provider._generateInternal(makeCtx({ garmentImage: 'GARMENT_X' }));

    // 两种品类任一均应取 garments[0].image
    assert.ok(
      capturedBody.input.top_garment_url === 'GARMENT_X' || capturedBody.input.bottom_garment_url === 'GARMENT_X',
      'garmentImage 应来自 ctx.garments[0].image'
    );
  });

  it('7) restore_face === true', async () => {
    let capturedBody = null;
    provider.submitTask = async (body) => { capturedBody = body; return { output: { task_id: 'T7' } }; };
    provider.pollTask = async () => ({ output: { task_status: 'SUCCEEDED', results: [{ url: 'r' }] } });

    await provider._generateInternal(makeCtx());

    assert.strictEqual(capturedBody.parameters.restore_face, true);
  });

  it('8) resolution === -1', async () => {
    let capturedBody = null;
    provider.submitTask = async (body) => { capturedBody = body; return { output: { task_id: 'T8' } }; };
    provider.pollTask = async () => ({ output: { task_status: 'SUCCEEDED', results: [{ url: 'r' }] } });

    await provider._generateInternal(makeCtx());

    assert.strictEqual(capturedBody.parameters.resolution, -1);
  });

  it('9) dress 仍然被拒绝', async () => {
    await assert.rejects(
      () => provider._generateInternal(makeCtx({ category: 'dress' })),
      (err) => {
        assert.strictEqual(err.code, 'PROVIDER_CAPABILITY_UNSUPPORTED');
        return true;
      }
    );
  });

  it('10) 返回 task_id 后能正确轮询并返回 result URL', async () => {
    provider.submitTask = async () => ({ output: { task_id: 'TASK_123' } });
    provider.pollTask = async () => ({ output: { task_status: 'SUCCEEDED', results: [{ url: 'http://result/final' }] } });

    const res = await provider._generateInternal(makeCtx({ category: 'tops' }));

    assert.strictEqual(res.taskId, 'TASK_123');
    assert.strictEqual(res.url, 'http://result/final');
    assert.strictEqual(res.metadata.category, 'tops');
  });

  it('额外：personImage 缺失时抛错（不重新选图）', async () => {
    const ctx = { person: {}, garments: [{ image: 'G', category: 'tops' }] };
    await assert.rejects(() => provider._generateInternal(ctx), /personImage/);
  });

  it('额外：garment 缺失时抛错', async () => {
    const ctx = { person: { personImage: 'P' }, garments: [] };
    await assert.rejects(() => provider._generateInternal(ctx), /garment/);
  });
});

describe('AliyunTryOnProvider model variants', () => {
  it('aitryon-plus 同样支持 bottoms 映射', async () => {
    const provider = new AliyunTryOnProvider('aitryon-plus');
    installNetworkGuard(provider);
    let capturedBody = null;
    provider.submitTask = async (body) => { capturedBody = body; return { output: { task_id: 'M1' } }; };
    provider.pollTask = async () => ({ output: { task_status: 'SUCCEEDED', results: [{ url: 'r' }] } });

    await provider._generateInternal(makeCtx({ category: 'bottoms' }));

    assert.strictEqual(capturedBody.input.bottom_garment_url, 'GARMENT_X');
    assert.strictEqual(capturedBody.model, 'aitryon-plus');
  });
});

const test = require('node:test');
const assert = require('node:assert');
const b = require('./_bootstrap');

// 在 require index.js 之前，需先安装重定向。_bootstrap 已在其顶部完成。
// 但 Node require 缓存：必须先 require bootstrap，再 require index。
const { main } = require('../index.js');

const AVATAR_INIT = { _id: 'av1', user_id: 'user-abc', profile_snapshot: { heightCm: 170, weightKg: 60 }, views: { composite: 'cloud://env/avatar/composite.png' } };
const GARMENT_INIT = { _id: 'g1', user_id: 'user-abc', name: '白T', category: '上衣', original_file_id: 'cloud://env/g/1.png', type: 'upload', status: 'ready' };

test.beforeEach(() => { b.reset(); });

test('基线复刻：legacy 链路 preflight 失败不扣 quota（avatar composite 缺失）', async () => {
  const stores = b.docStores();
  stores.avatar_views = { ...AVATAR_INIT, views: {} };
  const r = await main({ action: 'submit', avatarViewId: 'av1', garmentIds: ['g1'] }).catch((e) => e);
  const code = (r && r.error) || (r && r.appCode) || '';
  assert.ok(/INVALID_ARGUMENT|人物参考图/.test(code), JSON.stringify(r));
  assert.strictEqual(b.tryonTasks().find((t) => t.status === 'success'), undefined);
});

test('基线复刻：正常链路走 legacy aigc.generateImages 成功（flag=false 默认）', async () => {
  b.setGetTempFile(({ fileList }) => ({ fileList: (fileList || []).map((id) => ({ fileID: id, tempFileURL: 'https://tmp/' + (typeof id === 'string' ? id.split('/').pop() : id) })) }));
  const r = await main({ action: 'submit', avatarViewId: 'av1', garmentIds: ['g1'] });
  b.setGetTempFile(() => { throw new Error('getTempFile not configured for this test'); });
  assert.strictEqual(r.ok, true, JSON.stringify(r));
  assert.strictEqual(r.status, 'success');
  assert.ok(r.tryonImageUrl || r.tryonImage);
});

test('基线复刻：reference preflight 失败 → fail closed 不生成', async () => {
  // 只返回 avatar ref，衣物 ref 缺失 → refImages 数量不一致 → fail closed
  b.setGetTempFile(() => ({ fileList: [{ fileID: 'cloud://env/avatar/composite.png', tempFileURL: 'https://tmp/comp.png' }] }));
  const r = await main({ action: 'submit', avatarViewId: 'av1', garmentIds: ['g1'] }).catch((e) => e);
  b.setGetTempFile(() => { throw new Error('getTempFile not configured for this test'); });
  const code = (r && r.error) || (r && r.appCode) || '';
  assert.ok(/PROVIDER_ERROR|参考图/.test(code), JSON.stringify(r));
  assert.strictEqual(b.tryonTasks().find((t) => t.status === 'success'), undefined);
});

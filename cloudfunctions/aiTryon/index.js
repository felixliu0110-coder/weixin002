const cloud = require('wx-server-sdk');
const { saveRemoteImage, validateTryonInputUrl } = require('./storage');
const { requireLogin, requireId, requireArray } = require('./validation');
const { getOwnedDoc } = require('./ownership');
const { resolveGarments } = require('./garments');
const { appError, fmtErr } = require('./errors');
const { assertTransition } = require('./taskState');
const { dateStr, consumeQuota, refundQuota, getQuota } = require('./quota');
const { requestDeletion, runDeletion } = require('./deletion');
const { finalizeTryonSuccessAtomically } = require('./callback');
const tryonEngine = require('./services/tryon-engine');
const { getPersonAssetService } = require('./services/person-asset');
const { normalizeGarmentCategory } = require('./services/tryon-engine/category');
const { buildTryonCacheKey, isImageCacheHit } = require('./tryonCache');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const PERSON_SOURCE_PRIORITY = ['originalPhoto', 'frontPhoto', 'anchorImage'];
const BODY_FIELDS = [
  ['gender', 'gender'], ['height_cm', 'heightCm'], ['weight_kg', 'weightKg'],
  ['shoulder_cm', 'shoulderCm'], ['bust_cm', 'bustCm'], ['waist_cm', 'waistCm'],
  ['hip_cm', 'hipCm'], ['leg_length_cm', 'legLengthCm'], ['arm_length_cm', 'armLengthCm'],
  ['neck_length_cm', 'neckLengthCm']
];

function mapProfileSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return {};
  const out = {};
  for (const [src, dst] of BODY_FIELDS) {
    const v = snapshot[src] ?? snapshot[dst];
    if (typeof v === 'number' && Number.isFinite(v)) out[dst] = v;
    if (src === 'gender' && typeof v === 'string' && v.trim()) out[dst] = v.trim();
  }
  return out;
}

function pickPersonSource(asset) {
  const map = { originalPhoto: ['original_photo', 'originalPhoto'], frontPhoto: ['front_photo', 'frontPhoto'], anchorImage: ['anchor_image', 'anchorImage'] };
  for (const key of PERSON_SOURCE_PRIORITY) {
    for (const field of map[key]) {
      const value = asset && asset[field];
      if (typeof value === 'string' && value.trim()) {
        return { url: value.trim(), type: key.replace('Photo', '_photo').replace('anchorImage', 'anchor_image') };
      }
    }
  }
  return { url: null, type: null };
}

async function toHttpsRefs(values) {
  const list = (values || []).filter(Boolean);
  const cloudIds = list.filter(v => v.indexOf('cloud://') === 0);
  if (!cloudIds.length) return list.slice();
  let res;
  try { res = await cloud.getTempFileURL({ fileList: cloudIds, maxAge: 3600 }); }
  catch (e) { throw appError('PROVIDER_ERROR', '参考图临时链接获取失败'); }
  const map = {};
  for (const f of res.fileList || []) if (f.tempFileURL) map[f.fileID] = f.tempFileURL;
  return list.map(v => {
    if (v.indexOf('cloud://') !== 0) return v;
    if (!map[v]) throw appError('PROVIDER_ERROR', '参考图临时链接获取失败');
    return map[v];
  });
}

async function resolvePersonAsset(profileId, openid) {
  const service = getPersonAssetService(db);
  const asset = await service.findByAvatarProfileId(profileId, openid);
  if (!asset) return null;
  const picked = pickPersonSource(asset);
  if (!picked.url) return null;
  return { asset, sourceType: picked.type, sourceUrl: picked.url };
}

function diagnostics() {
  const dashscopeConfigured = !!process.env.DASHSCOPE_API_KEY;
  const agnesConfigured = !!process.env.AGNES_API_KEY;
  return {
    ok: true,
    runtime: 'v1',
    engineLoaded: !!tryonEngine,
    provider: 'aitryon',
    model: 'aitryon',
    dashscopeConfigured,
    agnesConfigured,
    configurationConflict: dashscopeConfigured && agnesConfigured,
    mockFallback: false,
    engineFallback: false,
    videoEnabled: false
  };
}

async function sendSubscribe(openid, garmentName) {
  const tmplId = process.env.SUBSCRIBE_TMPL_ID;
  if (!tmplId || !openid) return false;
  try {
    await cloud.openapi.subscribeMessage.send({
      touser: openid, templateId: tmplId, page: 'pages/tryon-result/index',
      data: { thing1: { value: ('AI试穿「' + (garmentName || '所选衣物') + '」已生成').slice(0, 20) }, time1: { value: new Date().toISOString().slice(0, 16).replace('T', ' ') } }
    });
    return true;
  } catch (_) { return false; }
}

async function submit(event, openid) {
  const t0 = Date.now();
  requireLogin(openid);
  if (event.mode === 'video') throw appError('MODE_NOT_SUPPORTED', 'V1 暂不支持视频试穿');
  if (!event.avatarProfileId) throw appError('INVALID_TRYON_CONTEXT', '缺少人物档案，请先建立人物资料');
  const avatarProfileId = requireId(event.avatarProfileId, 'avatarProfileId');
  const garmentIds = requireArray(event.garmentIds || [], 'garmentIds', { max: 1 });
  if (garmentIds.length === 0) throw appError('INVALID_TRYON_CONTEXT', '请选择一件衣物后再试穿');
  const garmentId = requireId(garmentIds[0], 'garmentId');

  const profile = await getOwnedDoc(db, 'avatar_profiles', avatarProfileId, openid);
  const pa = await resolvePersonAsset(avatarProfileId, openid);
  if (!pa) throw appError('PERSON_ASSET_REQUIRED', '请先建立与当前人物档案绑定的人物资产');

  const garments = await resolveGarments(db, [garmentId], openid);
  const garment = garments[0];
  const normalized = normalizeGarmentCategory({ category: garment.category });
  if (normalized.category !== 'tops' && normalized.category !== 'bottoms') throw appError('UNSUPPORTED_TRYON_CATEGORY', '当前仅支持上衣和裤子试穿');
  if (!garment.originalFileId) throw appError('GARMENT_REFERENCE_REQUIRED', '衣物原图缺失，请重新上传衣物');

  const refs = await toHttpsRefs([pa.sourceUrl, garment.originalFileId]);
  if (refs.length !== 2) throw appError('PROVIDER_ERROR', '参考图数量不一致，生成中止');
  for (const ref of refs) await validateTryonInputUrl(ref);

  const personAssetId = String(pa.asset._id);
  const personAssetVersion = String(pa.asset.updated_at || pa.asset.updatedAt || 'v1');
  const cacheKey = buildTryonCacheKey({
    openid, avatarViewId: '', garmentIds: [garmentId], kind: 'ai_image', personAssetId, personAssetVersion
  });
  const prev = await db.collection('tryon_tasks').where({ cache_key: cacheKey, user_id: openid, type: 'ai_image', provider: 'aitryon' }).orderBy('createdAt', 'desc').limit(10).get();
  const pending = (prev.data || []).find(d => d.status === 'queued' || d.status === 'processing');
  if (pending) return { ok: true, taskId: pending._id, status: pending.status, pending: true, garmentName: garment.name || '所选衣物' };
  const hit = (prev.data || []).find(d => isImageCacheHit(d, Date.now()) && d.tryon_image);
  if (hit) {
    await finalizeTryonSuccessAtomically({ db, taskId: hit._id, tryonImage: hit.tryon_image, tryonVideo: '', provider: 'aitryon', now: Date.now() });
    return { ok: true, taskId: hit._id, status: 'success', cached: true, tryonImage: hit.tryon_image, tryonImageUrl: hit.tryon_image_url || '', garmentName: garment.name || '所选衣物' };
  }

  const quota = await consumeQuota(db, openid, dateStr());
  const now = Date.now();
  const taskData = {
    _openid: openid, user_id: openid, type: 'ai_image', stage: 'image', status: 'queued',
    avatar_view_id: null, avatar_profile_id: avatarProfileId, person_asset_id: personAssetId,
    person_source_type: pa.sourceType, garment_ids: [garmentId], garment_name: garment.name || '所选衣物',
    cache_key: cacheKey, strategy: 'BALANCED', provider: 'aitryon', model: 'aitryon', provider_task_id: '',
    quota_consumed: true, quota_refunded: false, started_at: null, completed_at: null,
    created_at: now, createdAt: now, updated_at: now
  };
  let taskId;
  try { taskId = (await db.collection('tryon_tasks').add({ data: taskData }))._id; }
  catch (e) { try { await refundQuota(db, openid, dateStr(), 'create-' + now); } catch (_) {} throw e; }
  assertTransition('queued', 'processing');
  await db.collection('tryon_tasks').doc(taskId).update({ data: { status: 'processing', started_at: Date.now(), updated_at: Date.now() } });

  const context = {
    // 重要：refs[0] 是经过 CloudBase cloud:// → HTTPS 临时公网 URL 解析后的真实人物引用。
    // Engine/context.normalizePerson() 会按 originalPhoto > frontPhoto > anchorImage 选择 personImage。
    // 因此这里必须把“实际已解析的引用”送入标准 Context；不能继续把原始 cloud:// ID 放回 Context，
    // 否则 Provider 的 DashScope 上传层会收到 cloud:// 并被 storage.downloadToBuffer() 拒绝为“仅支持 http/https”。
    person: { assetId: personAssetId, originalPhoto: refs[0], frontPhoto: null, anchorImage: null, bodyProfile: mapProfileSnapshot(profile.profile_snapshot || {}) },
    garments: [{ garmentId, image: refs[1], category: normalized.category, sourceCategory: garment.category, name: garment.name || '', profile: garment.profile || null }],
    options: { strategy: 'BALANCED', mode: 'image', preserveFace: true, background: 'keep' }
  };
  try {
    const res = await tryonEngine.submit(context, 'BALANCED');
    if (!res || res.ok === false || res.provider !== 'aitryon' || !res.taskId) {
      throw Object.assign(new Error((res && res.error) || 'aitryon 提交失败'), { code: (res && res.errorCode) || 'PROVIDER_ERROR' });
    }
    await db.collection('tryon_tasks').doc(taskId).update({ data: { provider: 'aitryon', model: 'aitryon', provider_task_id: res.taskId, updated_at: Date.now() } });
    console.log('aiTryon V1 submit accepted', 'taskId=' + taskId, 'providerTaskId=' + res.taskId, 'quotaUsed=' + quota.used, 'costMs=' + (Date.now() - t0));
    return { ok: true, taskId, status: 'processing', provider: 'aitryon', providerTaskId: res.taskId, garmentName: garment.name || '所选衣物' };
  } catch (e) {
    try { await refundQuota(db, openid, dateStr(), taskId); } catch (_) {}
    await db.collection('tryon_tasks').doc(taskId).update({ data: { status: 'failed', error: e.message || String(e), error_code: e.code || 'PROVIDER_ERROR', error_message: e.message || String(e), quota_refunded: true, completed_at: Date.now(), updated_at: Date.now() } });
    return { ok: false, taskId, error: e.message || String(e), errorCode: e.code || 'PROVIDER_ERROR' };
  }
}

async function retryTask(event, openid) {
  const taskId = requireId(event.taskId, 'taskId');
  const task = await getOwnedDoc(db, 'tryon_tasks', taskId, openid);
  if (task.type !== 'ai_image' || task.provider !== 'aitryon') {
    throw appError('LEGACY_TASK_NOT_SUPPORTED', '该任务属于历史运行链，不参与 V1 试穿');
  }
  if (task.status !== 'failed') {
    if (task.status === 'queued' || task.status === 'processing') {
      return { ok: true, taskId, status: task.status, pending: true, provider: 'aitryon', providerTaskId: task.provider_task_id || '' };
    }
    throw appError('INVALID_RETRY_STATE', '只有失败的 V1 试穿任务可以重新生成');
  }
  const garmentIds = requireArray(task.garment_ids || [], 'garmentIds', { max: 1 });
  const avatarProfileId = requireId(task.avatar_profile_id, 'avatarProfileId');
  console.log('[aiTryon] V20 retry submit', JSON.stringify({ oldTaskId: taskId, avatarProfileId, garmentIds }));
  return submit({ avatarProfileId, garmentIds, mode: 'image', strategy: 'BALANCED' }, openid);
}

async function status(event, openid) {
  console.log('[aiTryon] V19-RUNTIME status handler');
  const taskId = requireId(event.taskId, 'taskId');
  const task = await getOwnedDoc(db, 'tryon_tasks', taskId, openid);
  if (task.type !== 'ai_image' || task.provider !== 'aitryon') return { ok: false, taskId, error: 'LEGACY_TASK_NOT_SUPPORTED', message: '该任务属于历史运行链，不参与 V1 试穿' };
  if (task.status === 'processing' || task.status === 'queued') {
    if (!task.provider_task_id) return { ok: true, taskId, status: task.status, provider: 'aitryon' };
    let polled;
    try {
      polled = await tryonEngine.getTaskStatus('aitryon', task.provider_task_id);
    } catch (e) {
      const providerErrorCode = String((e && (e.code || e.errorCode || e.appCode)) || '').toUpperCase();
      const providerErrorMessage = e && e.message ? e.message : String(e);
      // Provider 查询明确返回“任务不存在/资源不存在”时，不能继续伪装成 processing。
      // 否则旧 provider_task_id 会永久占住 tryon_tasks，前端也会永久停留在生成页。
      const taskNotFound =
        providerErrorCode === 'PROVIDER_HTTP_404' ||
        providerErrorCode === 'TASK_NOT_FOUND' ||
        /task[^\n]*(not[ -]?found|不存在)|not[ -]?found[^\n]*task|resource[^\n]*(not[ -]?found|不存在)/i.test(providerErrorMessage);
      if (!taskNotFound) {
        console.warn('[aiTryon] provider poll transient error', JSON.stringify({
          taskId, providerTaskId: task.provider_task_id, errorCode: providerErrorCode || 'PROVIDER_ERROR', errorMessage: providerErrorMessage
        }));
        return { ok: true, taskId, status: 'processing', provider: 'aitryon', providerTaskId: task.provider_task_id, transientError: true };
      }
      polled = {
        provider: 'aitryon',
        status: 'UNKNOWN',
        rawStatus: 'UNKNOWN',
        normalized: 'UNKNOWN',
        imageUrl: '',
        errorCode: 'PROVIDER_TASK_NOT_FOUND',
        error: 'aitryon 任务不存在、已过期或已被清理'
      };
    }
    const normalizedProviderStatus = String((polled && (polled.normalized || polled.status || polled.rawStatus)) || '').toUpperCase();
    const providerSucceeded = normalizedProviderStatus === 'SUCCEEDED';
    const providerFailed = normalizedProviderStatus === 'FAILED' || normalizedProviderStatus === 'CANCELED' || normalizedProviderStatus === 'CANCELLED';
    const providerUnknown = normalizedProviderStatus === 'UNKNOWN';
    console.log('[aiTryon] provider poll', JSON.stringify({ taskId, providerTaskId: task.provider_task_id, status: polled && polled.status, rawStatus: polled && polled.rawStatus, normalized: polled && polled.normalized, providerSucceeded, providerFailed, providerUnknown, hasImageUrl: !!(polled && polled.imageUrl), errorCode: polled && polled.errorCode }));
    if (providerSucceeded) {
      if (!polled.imageUrl) return { ok: true, taskId, status: 'processing', stage: 'image', provider: 'aitryon', providerTaskId: task.provider_task_id, providerStatus: polled.rawStatus || '', transientError: true };
      let saved;
      try { saved = await saveRemoteImage(polled.imageUrl, 'tryon'); }
      catch (e) {
        console.error('[aiTryon] result image save failed', JSON.stringify({
          taskId,
          providerTaskId: task.provider_task_id,
          errorCode: (e && (e.code || e.errorCode)) || 'RESULT_IMAGE_SAVE_FAILED',
          errorMessage: e && e.message ? e.message : String(e)
        }));
        const code = (e && (e.code || e.errorCode)) || 'RESULT_IMAGE_SAVE_FAILED';
        const msg = e && e.message ? e.message : String(e);
        try { await refundQuota(db, openid, dateStr(task.created_at || task.createdAt || Date.now()), taskId); } catch (refundErr) {
          console.error('[aiTryon] quota refund failed after result save failure', JSON.stringify({ taskId, error: refundErr && refundErr.message ? refundErr.message : String(refundErr) }));
        }
        await db.collection('tryon_tasks').doc(taskId).update({ data: { status: 'failed', error: msg, error_code: code, error_message: msg, quota_refunded: true, completed_at: Date.now(), updated_at: Date.now() } });
        return { ok: false, taskId, status: 'failed', stage: 'image', provider: 'aitryon', providerTaskId: task.provider_task_id, error: '试穿结果图片保存失败', errorCode: code, errorMessage: msg };
      }
      try { await finalizeTryonSuccessAtomically({ db, taskId, tryonImage: saved, tryonVideo: '', provider: 'aitryon', now: Date.now() }); }
      catch (e) { return { ok: false, taskId, error: e.appCode || e.code || 'TRANSACTION_FAILED', message: e.message || '结果落库失败' }; }
    } else if (providerFailed || providerUnknown) {
      const code = providerUnknown ? 'PROVIDER_TASK_NOT_FOUND' : (polled.errorCode || 'PROVIDER_ERROR');
      const msg = providerUnknown
        ? (polled.error || 'aitryon 任务不存在、已过期或已被清理')
        : (polled.error || polled.errorMessage || 'aitryon 任务失败');
      try { await refundQuota(db, openid, dateStr(task.created_at || task.createdAt || Date.now()), taskId); }
      catch (refundErr) {
        console.error('[aiTryon] quota refund failed', JSON.stringify({ taskId, code, error: refundErr && refundErr.message ? refundErr.message : String(refundErr) }));
      }
      await db.collection('tryon_tasks').doc(taskId).update({ data: { status: providerUnknown ? 'failed' : (polled.status === 'CANCELED' ? 'cancelled' : 'failed'), error: msg, error_code: code, error_message: msg, quota_refunded: true, completed_at: Date.now(), updated_at: Date.now() } });
    }
  }
  const latest = await getOwnedDoc(db, 'tryon_tasks', taskId, openid);
  if (latest.status === 'success' && latest.notified !== true) {
    if (await sendSubscribe(openid, latest.garment_name)) { await db.collection('tryon_tasks').doc(taskId).update({ data: { notified: true, updated_at: Date.now() } }); }
  }
  return { ok: true, taskId, status: latest.status, stage: latest.stage, provider: latest.provider || 'aitryon', providerTaskId: latest.provider_task_id || '', tryonImage: latest.tryon_image || '', tryonImageUrl: latest.tryon_image_url || '', tryonVideo: '', error: latest.error || '', errorCode: latest.error_code || '', errorMessage: latest.error_message || '' };
}

async function listFavorites(openid) {
  const res = await db.collection('favorites').where({ user_id: openid }).limit(100).get();
  return { ok: true, list: (res.data || []).map(d => ({ id: d._id, garmentName: d.garment_name || 'AI 试穿', createdAt: d.created_at || d.createdAt || 0, image: d.image || '', videoUrl: '' })).sort((a,b) => b.createdAt - a.createdAt).slice(0, 50) };
}
async function addFavorite(event, openid) {
  const taskId = requireId(event.taskId, 'taskId'); const task = await getOwnedDoc(db, 'tryon_tasks', taskId, openid);
  if (task.provider !== 'aitryon' || task.status !== 'success') throw appError('INVALID_ARGUMENT', '只有 V1 真实试穿成功结果可以收藏');
  const res = await db.collection('tryon_results').where({ task_id: taskId }).limit(1).get(); const rec = res.data && res.data[0]; if (!rec) throw appError('NOT_FOUND', '试穿结果不存在，无法收藏');
  const dup = await db.collection('favorites').where({ user_id: openid, result_id: rec._id }).limit(1).get(); if (dup.data.length) return { ok: true, favoriteId: dup.data[0]._id, duplicate: true };
  const now = Date.now(); const add = await db.collection('favorites').add({ data: { _openid: openid, user_id: openid, result_id: rec._id, garment_name: rec.garment_name || task.garment_name || 'AI 试穿', image: rec.tryon_image || '', ai_tagged: true, created_at: now, updated_at: now } });
  return { ok: true, favoriteId: add._id, duplicate: false };
}
async function deleteFavorites(event, openid) { const ids = requireArray(event.ids || [], 'ids', { max: 50 }).map(v => requireId(v, 'id')); let removed = 0; for (const id of ids) { try { await getOwnedDoc(db, 'favorites', id, openid); await db.collection('favorites').doc(id).remove(); removed++; } catch (e) { if (e && e.appCode === 'NOT_FOUND') continue; throw e; } } return { ok: true, removed }; }

exports.main = async (event = {}) => {
  try {
    const { OPENID: openid } = cloud.getWXContext(); requireLogin(openid);
    if (event.action === 'diagnostics') return diagnostics();
    if (event.action === 'status') return status(event, openid);
    if (event.action === 'retry') return retryTask(event, openid);
    if (event.action === 'quota') return { ok: true, quota: await getQuota(db, openid, dateStr()) };
    if (event.action === 'history') { const r = await db.collection('tryon_results').where({ user_id: openid }).orderBy('createdAt', 'desc').limit(50).get(); return { ok: true, list: (r.data || []).map(d => ({ id:d._id, resultId:d._id, taskId:d.task_id || '', garmentId:d.garment_id || '', avatarViewId:d.avatar_view_id || '', garmentName:d.garment_name || 'AI 试穿', createdAt:d.createdAt || d.created_at || 0, image:d.tryon_image || '', videoUrl:'' })) }; }
    if (event.action === 'favoriteAdd') return addFavorite(event, openid);
    if (event.action === 'favorites') return listFavorites(openid);
    if (event.action === 'favoriteDelete') return deleteFavorites(event, openid);
    if (event.action === 'deleteAccount') { const req = await requestDeletion(db, openid); return runDeletion(db, cloud, openid, req.jobId); }
    if (event.action === 'personAsset') {
      const profileId = requireId(event.avatarProfileId, 'avatarProfileId'); await getOwnedDoc(db, 'avatar_profiles', profileId, openid); const service = getPersonAssetService(db);
      if (event.mode === 'ensure') { const asset = await service.ensureForAvatarProfile(profileId, openid, { originalPhoto: event.originalPhoto || event.original_photo || '', frontPhoto: event.frontPhoto || event.front_photo || '' }); return { ok: true, asset: asset || null }; }
      return { ok: true, asset: await service.findByAvatarProfileId(profileId, openid) };
    }
    if (event.action === 'findByAvatarProfileId') { const profileId = requireId(event.avatarProfileId, 'avatarProfileId'); return { ok: true, asset: await getPersonAssetService(db).findByAvatarProfileId(profileId, openid) }; }
    if (event.action === 'deleteHistory') { const ids = requireArray(event.ids || [], 'ids', { max: 50 }).map(v => requireId(v, 'id')); let removed=0; for (const id of ids) { const d=await getOwnedDoc(db,'tryon_results',id,openid); if (d.tryon_image && d.tryon_image.indexOf('cloud://')===0) { try { await cloud.deleteFile({fileList:[d.tryon_image]}); } catch (_) {} } await db.collection('tryon_results').doc(id).remove(); removed++; } return {ok:true,removed}; }
    return submit(event, openid);
  } catch (e) {
    console.log('aiTryon V1 main fail', 'error=' + fmtErr(e));
    return { ok: false, error: e.appCode || e.code || 'INTERNAL', message: e.appCode ? e.message : (e.message || '内部错误') };
  }
};

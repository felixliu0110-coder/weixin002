const PROVIDER_NAMES = { ALIYUN_TRYON: 'aitryon' };
const STRATEGY_NAMES = { BALANCED: 'BALANCED' };
const GARMENT_CATEGORIES = { TOPS: 'tops', BOTTOMS: 'bottoms', DRESS: 'dress' };
function createResponse(result = {}) {
  const status = result.status || result.rawStatus || result.normalized || '';
  const rawStatus = result.rawStatus || result.status || '';
  const normalized = result.normalized || result.status || result.rawStatus || '';
  return {
    ok: result.ok !== false,
    provider: result.provider || 'aitryon',
    imageUrl: result.imageUrl || result.resultUrl || '',
    cost: result.cost || 0,
    latency: result.latencyMs || 0,
    taskId: result.taskId || '',
    status,
    rawStatus,
    normalized,
    error: result.error || result.errorMessage || '',
    errorCode: result.errorCode || '',
    metadata: result.metadata || {}
  };
}
function createErrorResponse(error, provider = 'engine') {
  return { ok: false, provider, imageUrl: '', cost: 0, latency: 0, taskId: '', error: error.message || String(error), errorCode: error.code || 'UNKNOWN_ERROR', metadata: {} };
}
module.exports = { PROVIDER_NAMES, STRATEGY_NAMES, GARMENT_CATEGORIES, createResponse, createErrorResponse };

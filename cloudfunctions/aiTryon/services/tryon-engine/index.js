const { getRouter } = require('./router');
const { STRATEGY_NAMES } = require('./types');
const { normalizeContext, validateContext } = require('./context');
async function submit(params = {}, strategy = STRATEGY_NAMES.BALANCED) {
  const ctx = normalizeContext(params); const v = validateContext(ctx);
  if (!v.valid) return { ok: false, provider: 'engine', imageUrl: '', cost: 0, error: (v.errors || []).map(e => e.message).join('; '), errorCode: v.errorCode, metadata: {} };
  if (ctx.options.mode !== 'image') return { ok: false, provider: 'engine', imageUrl: '', cost: 0, error: 'V1 仅支持图片试穿', errorCode: 'MODE_NOT_SUPPORTED', metadata: {} };
  const result = await getRouter().submit(ctx, strategy); if (result && ctx.person.personSourceType) result.metadata = { ...(result.metadata || {}), personSourceType: ctx.person.personSourceType }; return result;
}
async function getTaskStatus(providerName, providerTaskId) { return getRouter().getTaskStatus(providerName, providerTaskId); }
function getStatus() { return getRouter().getStatus(); }
function getAvailableProviders() { return getRouter().getAvailableProviders(); }
module.exports = { submit, getTaskStatus, getStatus, getAvailableProviders, _normalizeContext: normalizeContext, _validateContext: validateContext };

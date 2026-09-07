const https = require('https');
const crypto = require('crypto');
const { downloadToBuffer, detectImageContentType } = require('../../../storage');

const DASHSCOPE_API_HOST = 'dashscope.aliyuncs.com';
const DASHSCOPE_UPLOAD_PATH = '/api/v1/uploads?action=getPolicy&model=aitryon';

function requestJson(method, path, headers = {}, body = '') {
  return new Promise((resolve, reject) => {
    const req = https.request({
      method,
      hostname: DASHSCOPE_API_HOST,
      path,
      headers: { ...headers, ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {}) },
      timeout: 30000,
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let json;
        try { json = JSON.parse(text); } catch (_) {
          return reject(Object.assign(new Error('DashScope 返回非 JSON'), { code: 'PROVIDER_INVALID_RESPONSE', statusCode: res.statusCode }));
        }
        if (res.statusCode >= 400) {
          return reject(Object.assign(new Error(json.message || json.error || ('DashScope HTTP ' + res.statusCode)), { code: json.code || ('PROVIDER_HTTP_' + res.statusCode), statusCode: res.statusCode }));
        }
        resolve(json);
      });
      res.on('error', reject);
    });
    req.on('timeout', () => { req.destroy(); reject(Object.assign(new Error('DashScope request timeout'), { code: 'PROVIDER_TIMEOUT', statusCode: 408 })); });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function buildMultipart(fields, fileField, fileName, fileBuffer, contentType) {
  const boundary = '----weixin002-' + crypto.randomBytes(12).toString('hex');
  const chunks = [];
  const add = (s) => chunks.push(Buffer.from(s, 'utf8'));
  for (const [name, value] of Object.entries(fields)) {
    add('--' + boundary + '\r\n');
    add('Content-Disposition: form-data; name="' + name + '"\r\n\r\n');
    add(String(value));
    add('\r\n');
  }
  add('--' + boundary + '\r\n');
  add('Content-Disposition: form-data; name="' + fileField + '"; filename="' + fileName.replace(/[^a-zA-Z0-9._-]/g, '_') + '"\r\n');
  add('Content-Type: ' + contentType + '\r\n\r\n');
  chunks.push(fileBuffer);
  add('\r\n--' + boundary + '--\r\n');
  return { body: Buffer.concat(chunks), contentType: 'multipart/form-data; boundary=' + boundary };
}

async function getUploadPolicy() {
  const response = await requestJson('GET', DASHSCOPE_UPLOAD_PATH, {
    Authorization: 'Bearer ' + process.env.DASHSCOPE_API_KEY,
    'Content-Type': 'application/json',
  });
  if (!response || !response.data || !response.data.upload_host || !response.data.upload_dir) {
    throw Object.assign(new Error('DashScope 临时文件上传凭证无效'), { code: 'PROVIDER_INVALID_RESPONSE' });
  }
  return response.data;
}

function uploadToDashScope(policy, buffer, contentType, extension) {
  return new Promise((resolve, reject) => {
    const safeExt = extension || (contentType === 'image/png' ? 'png' : 'jpg');
    const fileName = 'tryon-' + Date.now() + '-' + crypto.randomBytes(5).toString('hex') + '.' + safeExt;
    const key = policy.upload_dir.replace(/\/$/, '') + '/' + fileName;
    const multipart = buildMultipart({
      OSSAccessKeyId: policy.oss_access_key_id,
      Signature: policy.signature,
      policy: policy.policy,
      'x-oss-object-acl': policy.x_oss_object_acl,
      'x-oss-forbid-overwrite': policy.x_oss_forbid_overwrite,
      key,
      success_action_status: '200',
    }, 'file', fileName, buffer, contentType);
    let u;
    try { u = new URL(policy.upload_host); } catch (_) { return reject(Object.assign(new Error('DashScope 上传地址无效'), { code: 'PROVIDER_INVALID_RESPONSE' })); }
    const req = https.request({
      method: 'POST', hostname: u.hostname, port: u.port || undefined, path: u.pathname + u.search,
      headers: { 'Content-Type': multipart.contentType, 'Content-Length': multipart.body.length }, timeout: 30000,
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(Object.assign(new Error('DashScope 临时文件上传失败'), { code: 'PROVIDER_UPLOAD_FAILED', statusCode: res.statusCode }));
        }
        resolve('oss://' + key);
      });
      res.on('error', reject);
    });
    req.on('timeout', () => { req.destroy(); reject(Object.assign(new Error('DashScope 临时文件上传超时'), { code: 'PROVIDER_TIMEOUT', statusCode: 408 })); });
    req.on('error', reject);
    req.end(multipart.body);
  });
}

async function uploadReferenceToDashScope(url, policy) {
  const buffer = await downloadToBuffer(url);
  const contentType = detectImageContentType(buffer);
  if (!contentType || (contentType !== 'image/jpeg' && contentType !== 'image/png')) {
    throw Object.assign(new Error('试穿参考图必须是有效的 JPEG/PNG'), { code: 'INVALID_ARGUMENT' });
  }
  return uploadToDashScope(policy, buffer, contentType, contentType === 'image/png' ? 'png' : 'jpg');
}

class AliyunTryOnProvider {
  constructor(model = 'aitryon') {
    if (model !== 'aitryon') throw new Error('V1 provider model must be aitryon');
    this.name = 'aitryon'; this.displayName = '阿里云 aitryon'; this.model = 'aitryon'; this.defaultCost = 20;
    this.apiUrl = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/image2image/image-synthesis';
  }
  isConfigured() { return !!process.env.DASHSCOPE_API_KEY; }
  getCost() { return this.defaultCost; }
  async submitOnly(ctx) {
    if (!this.isConfigured()) throw Object.assign(new Error('DASHSCOPE_API_KEY 未配置'), { code: 'PROVIDER_NOT_CONFIGURED' });
    const person = ctx && ctx.person || {}; const g = Array.isArray(ctx && ctx.garments) ? ctx.garments[0] : null;
    if (!person.personImage) throw Object.assign(new Error('person.personImage 缺失'), { code: 'INVALID_TRYON_CONTEXT' });
    if (!g || !g.image) throw Object.assign(new Error('garment.image 缺失'), { code: 'INVALID_TRYON_CONTEXT' });
    if (g.category !== 'tops' && g.category !== 'bottoms') throw Object.assign(new Error('当前品类不支持 aitryon'), { code: 'PROVIDER_CAPABILITY_UNSUPPORTED' });
    // CloudBase 临时公网 URL 在 DashScope DataInspection 阶段可能无法稳定解码。
    // V1 首测改为：服务端安全下载真实图片 → 上传到 DashScope 官方临时 OSS →
    // aitryon 使用同账号、同模型绑定的 oss:// 引用。这样 DataInspection 不再依赖
    // 第三方 CloudBase URL 的访问/响应特征。临时 OSS 有效期 48h，仅作为 V1 首测/低并发桥接；
    // 生产高并发阶段再切换到长期 OSS。
    const policy = await getUploadPolicy();
    const personOssUrl = await uploadReferenceToDashScope(person.personImage, policy);
    const garmentOssUrl = await uploadReferenceToDashScope(g.image, policy);
    const input = { person_image_url: personOssUrl };
    if (g.category === 'tops') input.top_garment_url = garmentOssUrl; else input.bottom_garment_url = garmentOssUrl;
    const body = { model: 'aitryon', input, parameters: { resolution: -1, restore_face: true } };
    const response = await this._request('POST', '/api/v1/services/aigc/image2image/image-synthesis', body);
    const taskId = response && response.output && response.output.task_id;
    if (!taskId) throw Object.assign(new Error('DashScope 未返回 task_id'), { code: 'PROVIDER_INVALID_RESPONSE' });
    return { provider: 'aitryon', taskId, cost: this.defaultCost, imageUrl: '', metadata: { model: 'aitryon', category: g.category } };
  }
  async getTaskStatus(taskId) {
    if (!this.isConfigured()) throw Object.assign(new Error('DASHSCOPE_API_KEY 未配置'), { code: 'PROVIDER_NOT_CONFIGURED' });
    const response = await this._request('GET', '/api/v1/tasks/' + encodeURIComponent(taskId));
    const out = response && response.output || {}; const status = out.task_status || 'UNKNOWN';
    const map = { SUCCEEDED: 'SUCCEEDED', FAILED: 'FAILED', CANCELED: 'CANCELED', CANCELLED: 'CANCELED', PENDING: 'PROCESSING', 'PRE-PROCESSING': 'PROCESSING', RUNNING: 'PROCESSING', 'POST-PROCESSING': 'PROCESSING' };
    const normalized = map[status] || 'UNKNOWN';
    const imageUrl = out.image_url || (Array.isArray(out.results) && out.results[0] && out.results[0].url) || '';
    const errorCode = out.code || out.error_code || '';
    const errorMessage = out.message || out.error || '';
    console.log('[aitryon] task status', JSON.stringify({ taskId, rawStatus: status, normalized, hasImageUrl: !!imageUrl, errorCode, errorMessage }));
    if (normalized === 'SUCCEEDED' && !imageUrl) return { provider: 'aitryon', status: 'FAILED', error: '任务成功但缺少结果图片地址', errorCode: 'PROVIDER_RESULT_MISSING', rawStatus: status };
    return { provider: 'aitryon', status: normalized, imageUrl, taskId, rawStatus: status, error: errorMessage, errorCode };
  }
  _request(method, path, body) {
    return new Promise((resolve, reject) => {
      const u = new URL('https://dashscope.aliyuncs.com' + path); const payload = body ? JSON.stringify(body) : '';
      const req = https.request({ method, hostname: u.hostname, path: u.pathname + u.search, headers: { Authorization: 'Bearer ' + process.env.DASHSCOPE_API_KEY, ...(body ? { 'Content-Type': 'application/json', 'X-DashScope-Async': 'enable', 'X-DashScope-OssResourceResolve': 'enable', 'Content-Length': Buffer.byteLength(payload) } : {}) }, timeout: 30000 }, res => {
        let data = ''; res.on('data', c => { data += c; }); res.on('end', () => { let json; try { json = JSON.parse(data); } catch (_) { return reject(Object.assign(new Error('DashScope 返回非 JSON'), { code: 'PROVIDER_INVALID_RESPONSE', statusCode: res.statusCode })); } if (res.statusCode >= 400) return reject(Object.assign(new Error(json.message || json.error || ('DashScope HTTP ' + res.statusCode)), { code: json.code || ('PROVIDER_HTTP_' + res.statusCode), statusCode: res.statusCode })); resolve(json); });
      });
      req.on('timeout', () => { req.destroy(); reject(Object.assign(new Error('DashScope request timeout'), { code: 'PROVIDER_TIMEOUT', statusCode: 408 })); }); req.on('error', reject); if (payload) req.write(payload); req.end();
    });
  }
}
module.exports = AliyunTryOnProvider;

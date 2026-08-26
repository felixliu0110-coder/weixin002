/* V2-POC-01: 真实人物 vs Avatar Composite 试穿对比实验
 *
 * 完全隔离生产环境：
 * - 不修改 tryon_tasks / tryon_results
 * - 不写生产集合
 * - 不使用生产 aiTryon 云函数
 *
 * 实验目的：验证真实人物照片是否比 Avatar Composite 更适合作为 VTON 输入
 *
 * 环境变量：
 *   DASHSCOPE_API_KEY — 阿里云 DashScope API Key
 *
 * 调用方式：
 *   wx.cloud.callFunction({ name: 'experimentsTryOnV2', data: { action: 'run' } })
 */

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// ===== 常量 =====
const MODEL = 'aitryon-plus';
const API_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/image2image/image-synthesis';
const POLL_URL = 'https://dashscope.aliyuncs.com/api/v1/tasks/';
const MAX_POLL_ATTEMPTS = 60; // 180s / 3s
const POLL_INTERVAL_MS = 3000;
const RESULT_URL_EXPIRY_HOURS = 24;

// ===== 工具函数 =====
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function fmtErr(e) {
  if (!e) return 'unknown error';
  if (typeof e === 'string') return e;
  return e.message || e.errMsg || JSON.stringify(e);
}

function getApiKey() {
  return process.env.DASHSCOPE_API_KEY || '';
}

// ===== HTTP 请求 =====
function dashscopeRequest(method, path, body, apiKey) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_URL + path);
    const https = require('https');
    const bodyStr = body !== undefined ? JSON.stringify(body) : '';
    const options = {
      method,
      hostname: url.hostname,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey,
        'X-DashScope-Async': 'enable'
      },
      timeout: 30000
    };
    if (bodyStr) options.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (e) { /* non-JSON */ }
        if (res.statusCode >= 400) {
          reject(new Error(`DashScope ${method} ${path} ${res.statusCode}: ${JSON.stringify(json?.error || json || data).slice(0, 500)}`));
        } else {
          resolve(json || {});
        }
      });
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('DASHSCOPE_REQUEST_TIMEOUT')); });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// 轮询任务状态
async function pollTask(taskId, apiKey, maxAttempts = MAX_POLL_ATTEMPTS) {
  for (let i = 0; i < maxAttempts; i++) {
    await sleep(POLL_INTERVAL_MS);
    try {
      const res = await dashscopeRequest('GET', `/${taskId}`, undefined, apiKey);
      if (res.output && res.output.task_status) {
        return res;
      }
    } catch (e) {
      // 单次轮询失败不中断，继续重试
      console.log('pollTask attempt failed', 'taskId=' + taskId, 'attempt=' + (i + 1), 'error=' + fmtErr(e));
    }
  }
  return { output: { task_status: 'TIMEOUT' } };
}

// 下载图片并保存到云存储
async function downloadAndSave(imageUrl, directory) {
  return new Promise((resolve, reject) => {
    const https = require('https');
    const fileExt = imageUrl.split('.').pop().split('?')[0] || 'jpg';
    const cloudPath = directory + '/' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + '.' + fileExt;
    
    https.get(imageUrl, { timeout: 30000, headers: { 'User-Agent': 'V2-POC-01-Downloader/1.0' } }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`IMAGE_DOWNLOAD_FAILED: HTTP ${res.statusCode}`));
        return;
      }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', async () => {
        try {
          const buffer = Buffer.concat(chunks);
          const uploadRes = await cloud.uploadFile({
            cloudPath,
            fileContent: buffer
          });
          resolve({ success: true, fileID: uploadRes.fileID, buffer });
        } catch (e) {
          resolve({ success: false, error: fmtErr(e), buffer });
        }
      });
    }).on('error', e => reject(new Error('IMAGE_DOWNLOAD_ERROR: ' + fmtErr(e))));
  });
}

// 获取临时 HTTPS URL
async function getTempUrl(fileId) {
  try {
    const res = await cloud.getTempFileURL({ fileList: [fileId], maxAge: 3600 });
    if (res.fileList && res.fileList[0] && res.fileList[0].tempFileURL) {
      return res.fileList[0].tempFileURL;
    }
    return '';
  } catch (e) {
    console.log('getTempUrl fail', 'fileId=' + fileId, 'error=' + fmtErr(e));
    return '';
  }
}

// ===== 数据获取 =====
async function getUserData(openid) {
  // 获取最新 avatar_views
  const avRes = await db.collection('avatar_views')
    .where({ user_id: openid })
    .orderBy('created_at', 'desc')
    .limit(1)
    .get();
  
  // 获取用户上传的衣物（优先上衣）
  const garmentRes = await db.collection('garments')
    .where({ user_id: openid, type: 'upload', status: 'ready' })
    .orderBy('created_at', 'desc')
    .limit(10)
    .get();
  
  // 获取人物档案
  const profileRes = await db.collection('avatar_profiles')
    .where({ user_id: openid })
    .orderBy('created_at', 'desc')
    .limit(1)
    .get();

  return {
    avatarView: avRes.data && avRes.data[0],
    garments: garmentRes.data || [],
    profile: profileRes.data && profileRes.data[0]
  };
}

// ===== 输入校验 =====
function checkInput(url, fieldName) {
  if (!url || url.indexOf('https://') !== 0) {
    return { valid: false, reason: fieldName + ' URL 无效或缺失' };
  }
  return { valid: true, reason: null };
}

// ===== 提交 aitryon-plus 任务 =====
async function submitTryon(personImageUrl, garmentImageUrl, apiKey) {
  const body = {
    model: MODEL,
    input: {
      person_image_url: personImageUrl,
      top_garment_url: garmentImageUrl
    },
    parameters: {
      resolution: -1,
      restore_face: true
    }
  };

  const res = await dashscopeRequest('POST', '', body, apiKey);
  
  if (!res.output || !res.output.task_id) {
    throw new Error('TASK_CREATE_FAILED: ' + JSON.stringify(res));
  }

  return {
    requestId: res.request_id || '',
    taskId: res.output.task_id
  };
}

// ===== 运行单个 Case =====
async function runCase(caseId, personSourceType, openid) {
  const t0 = Date.now();
  const result = {
    caseId,
    personSourceType,
    status: 'PENDING',
    blockReason: null,
    inputCheck: null,
    garmentId: null,
    garmentCategory: null,
    personImageUrl: null,
    garmentImageUrl: null,
    model: MODEL,
    requestId: null,
    taskId: null,
    apiStatus: null,
    latencyMs: null,
    resultUrl: null,
    savedFileId: null,
    createdAt: new Date().toISOString()
  };

  const apiKey = getApiKey();
  if (!apiKey) {
    result.status = 'BLOCKED';
    result.blockReason = 'BLOCKED_API_KEY_MISSING';
    return result;
  }

  // 获取用户数据
  const userData = await getUserData(openid);
  if (!userData.avatarView) {
    result.status = 'BLOCKED';
    result.blockReason = 'BLOCKED_NO_AVATAR_VIEW';
    return result;
  }
  if (userData.avatarView.status !== 'ready') {
    result.status = 'BLOCKED';
    result.blockReason = 'BLOCKED_AVATAR_NOT_READY';
    return result;
  }
  if (userData.garments.length === 0) {
    result.status = 'BLOCKED';
    result.blockReason = 'BLOCKED_NO_UPLOAD_GARMENT';
    return result;
  }

  // 选择衣物：优先上衣
  const garment = userData.garments.find(g => g.category === '上衣' && g.original_file_id) 
    || userData.garments.find(g => g.original_file_id);
  if (!garment) {
    result.status = 'BLOCKED';
    result.blockReason = 'BLOCKED_NO_TOP_GARMENT';
    return result;
  }

  result.garmentId = garment._id;
  result.garmentCategory = garment.category;

  // CASE-A: 真实 body_photo
  // CASE-B: avatar composite
  let personFileId = '';
  if (personSourceType === 'real_body_photo') {
    personFileId = userData.profile && (userData.profile.body_photo_id || userData.profile.bodyPhoto);
    if (!personFileId || personFileId.indexOf('cloud://') !== 0) {
      result.status = 'BLOCKED';
      result.blockReason = 'BLOCKED_PERSON_ASSET';
      return result;
    }
  } else if (personSourceType === 'avatar_composite') {
    personFileId = userData.avatarView.views && userData.avatarView.views.composite;
    if (!personFileId || personFileId.indexOf('cloud://') !== 0) {
      result.status = 'BLOCKED';
      result.blockReason = 'BLOCKED_AVATAR_COMPOSITE';
      return result;
    }
  }

  const garmentFileId = garment.original_file_id;

  // 转换为临时 HTTPS URL
  const [personUrl, garmentUrl] = await Promise.all([
    getTempUrl(personFileId),
    getTempUrl(garmentFileId)
  ]);

  if (!personUrl) {
    result.status = 'BLOCKED';
    result.blockReason = 'BLOCKED_PERSON_ASSET';
    return result;
  }
  if (!garmentUrl) {
    result.status = 'BLOCKED';
    result.blockReason = 'BLOCKED_GARMENT_ASSET';
    return result;
  }

  result.personImageUrl = personUrl;
  result.garmentImageUrl = garmentUrl;

  // 输入校验
  const personCheck = checkInput(personUrl, 'person');
  const garmentCheck = checkInput(garmentUrl, 'garment');
  if (!personCheck.valid || !garmentCheck.valid) {
    result.status = 'BLOCKED';
    result.blockReason = 'BLOCKED_INPUT_INVALID';
    return result;
  }
  result.inputCheck = 'pass';

  // 提交 API 任务
  let submitRes;
  try {
    submitRes = await submitTryon(personUrl, garmentUrl, apiKey);
  } catch (e) {
    result.status = 'FAILED';
    result.blockReason = 'API_ERROR: ' + fmtErr(e);
    result.latencyMs = Date.now() - t0;
    return result;
  }

  result.requestId = submitRes.requestId;
  result.taskId = submitRes.taskId;

  // 轮询
  let pollRes;
  try {
    pollRes = await pollTask(submitRes.taskId, apiKey);
  } catch (e) {
    result.status = 'FAILED';
    result.blockReason = 'POLL_ERROR: ' + fmtErr(e);
    result.latencyMs = Date.now() - t0;
    return result;
  }

  result.apiStatus = pollRes.output && pollRes.output.task_status;

  if (result.apiStatus !== 'SUCCEEDED') {
    result.status = 'FAILED';
    result.blockReason = 'API_STATUS: ' + (result.apiStatus || 'UNKNOWN');
    result.latencyMs = Date.now() - t0;
    return result;
  }

  // 获取结果 URL
  const results = pollRes.output && pollRes.output.results;
  const resultUrl = results && results[0] && results[0].url;
  if (!resultUrl) {
    result.status = 'FAILED';
    result.blockReason = 'NO_RESULT_URL';
    result.latencyMs = Date.now() - t0;
    return result;
  }

  result.resultUrl = resultUrl;
  result.latencyMs = Date.now() - t0;

  // 下载并保存到云存储（防止 URL 24h 过期）
  try {
    const saveRes = await downloadAndSave(resultUrl, 'tryon_v2_experiments');
    if (saveRes.success) {
      result.savedFileId = saveRes.fileID;
    } else {
      result.blockReason = 'SAVE_FAILED: ' + (saveRes.error || 'unknown');
    }
  } catch (e) {
    result.blockReason = 'SAVE_ERROR: ' + fmtErr(e);
  }

  result.status = 'SUCCESS';
  return result;
}

// ===== 主入口 =====
exports.main = async (event, context) => {
  try {
    const { OPENID: openid } = cloud.getWXContext();
    
    if (!openid) {
      return { ok: false, error: 'UNAUTHORIZED' };
    }

    const action = event.action || 'run';
    const apiKey = getApiKey();

    if (action === 'status') {
      return {
        ok: true,
        blockingIssues: !apiKey ? [{ id: 'B1', severity: 'P0', description: 'DASHSCOPE_API_KEY 未配置' }] : [],
        dashscopeKeyConfigured: !!apiKey
      };
    }

    if (action !== 'run') {
      return { ok: false, error: 'Unknown action: ' + action };
    }

    // 检查 API Key
    if (!apiKey) {
      return {
        ok: true,
        status: 'BLOCKED',
        blockingIssues: [{ id: 'B1', severity: 'P0', description: 'DASHSCOPE_API_KEY 未配置' }],
        cases: []
      };
    }

    // 并行运行两个 Case
    const [caseA, caseB] = await Promise.all([
      runCase('V2-POC-01-A', 'real_body_photo', openid),
      runCase('V2-POC-01-B', 'avatar_composite', openid)
    ]);

    const allBlocked = caseA.status === 'BLOCKED' && caseB.status === 'BLOCKED';
    const summary = allBlocked 
      ? '两个 Case 均被阻塞，请检查阻塞原因'
      : `CASE-A: ${caseA.status}${caseA.blockReason ? ' (' + caseA.blockReason + ')' : ''} | CASE-B: ${caseB.status}${caseB.blockReason ? ' (' + caseB.blockReason + ')' : ''}`;

    return {
      ok: true,
      poc: 'V2-POC-01',
      executedAt: new Date().toISOString(),
      summary,
      cases: [caseA, caseB]
    };

  } catch (e) {
    console.log('experimentsTryOnV2 main error', 'error=' + fmtErr(e));
    return { ok: false, error: fmtErr(e) };
  }
};

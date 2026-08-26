/**
 * T2 Real VTON Benchmark Runner
 * 
 * 验证专业 AI 试衣模型 vs 当前 Agnes 通用图生图方案
 * 
 * 运行方式：
 *   1. 本地 Node.js: node experiments/t2/t2-runner.js
 *   2. 云函数: wx.cloud.callFunction({ name: 'experimentsT2', data: { action: 'run' } })
 * 
 * 环境变量要求：
 *   AGNES_API_KEY  — Agnes API Key（A 组）
 *   ALIYUN_API_KEY — 阿里云 DashScope API Key（B/C 组）
 * 
 * 阻塞条件：
 *   B1: AGNES_API_KEY 未配置 → A 组 BLOCKED
 *   B2: ALIYUN_API_KEY 未配置 → B/C 组 BLOCKED
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// ===== 配置 =====
const BASE_DIR = path.resolve(__dirname, '../..');
const CASES_PATH = path.join(__dirname, 'cases.json');
const RESULTS_PATH = path.join(__dirname, 'results.json');
const OUTPUT_DIR = path.join(__dirname, 'output');

// 确保输出目录存在
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// ===== 工具函数 =====
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function readEnv(key) {
  return process.env[key] || '';
}

function fmtErr(e) {
  if (!e) return 'unknown error';
  if (typeof e === 'string') return e;
  return e.message || e.errMsg || JSON.stringify(e);
}

function base64FromFile(filePath) {
  const absPath = path.resolve(BASE_DIR, filePath);
  if (!fs.existsSync(absPath)) {
    throw new Error(`FILE_NOT_FOUND: ${absPath}`);
  }
  return fs.readFileSync(absPath).toString('base64');
}

// HTTP 请求封装
function requestJson(method, url, body, timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https');
    const lib = isHttps ? https : http;
    const urlObj = new URL(url);
    const options = {
      method,
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      headers: { 'Content-Type': 'application/json' },
      timeout: timeoutMs
    };
    const bodyStr = body !== undefined ? JSON.stringify(body) : '';
    if (bodyStr) options.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    
    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (e) { /* non-JSON */ }
        if (res.statusCode >= 400) {
          reject(new Error(`${method} ${url} ${res.statusCode}: ${JSON.stringify(json?.error || json || data).slice(0, 500)}`));
        } else {
          resolve(json || {});
        }
      });
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('REQUEST_TIMEOUT')); });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ===== 加载用例 =====
function loadCases() {
  const raw = fs.readFileSync(CASES_PATH, 'utf-8');
  return JSON.parse(raw);
}

function saveResults(results) {
  fs.writeFileSync(RESULTS_PATH, JSON.stringify(results, null, 2), 'utf-8');
  const outCases = path.join(OUTPUT_DIR, 'cases.json');
  fs.writeFileSync(outCases, JSON.stringify(results.cases || {}, null, 2), 'utf-8');
}

// ================================================================
// A 组：Agnes Baseline
// ================================================================
async function runAgnes(person, garment) {
  const key = readEnv('AGNES_API_KEY');
  if (!key) {
    return {
      status: 'BLOCKED', reason: 'AGNES_API_KEY not configured',
      personId: person.id, garmentId: garment.id, provider: 'A',
      modelName: 'agnes-image-2.1-flash'
    };
  }

  const t0 = Date.now();
  try {
    const personB64 = base64FromFile(person.imagePath);
    const garmentB64 = base64FromFile(garment.imagePath);

    const prompt = `虚拟试穿效果图：一位身高170cm体重60kg的女性，自然黄种人肤色，全身正面站姿，穿着${garment.name}，服装版型颜色图案与参考图完全一致，纯白色背景，均匀柔和三点布光，写实摄影风格，照片级画质。禁止：改变人物面部，服装变形，添加参考图没有的元素，画面文字水印。`;

    const body = {
      model: 'agnes-image-2.1-flash',
      prompt,
      size: '1024x1024',
      extra_body: { response_format: 'url' },
      refImages: [
        `data:image/jpeg;base64,${personB64}`,
        `data:image/jpeg;base64,${garmentB64}`
      ]
    };

    const res = await requestJson('POST', 'https://apihub.agnes-ai.com/v1/images/generations', body, 120000);
    const urls = (res.data || []).map(d => d && d.url).filter(Boolean);
    const resultUrl = urls[0] || '';

    return {
      status: 'SUCCESS',
      provider: 'A',
      modelName: 'agnes-image-2.1-flash',
      personId: person.id,
      garmentId: garment.id,
      requestPayload: { model: 'agnes-image-2.1-flash', size: '1024x1024', refCount: 2 },
      resultUrl,
      latencyMs: Date.now() - t0,
      cost: '约 ¥0.02-0.1/次',
      resolution: '1024x1024',
      restoreFace: false
    };
  } catch (e) {
    return {
      status: 'FAILED',
      provider: 'A',
      personId: person.id,
      garmentId: garment.id,
      error: fmtErr(e),
      latencyMs: Date.now() - t0
    };
  }
}

// ================================================================
// B/C 组：阿里云 aitryon（标准版 / Plus版）
// ================================================================
async function runAliyunTryon(person, garment, providerType) {
  const key = readEnv('ALIYUN_API_KEY');
  if (!key) {
    return {
      status: 'BLOCKED', reason: 'ALIYUN_API_KEY not configured',
      personId: person.id, garmentId: garment.id, provider: providerType === 'plus' ? 'C' : 'B',
      modelName: providerType === 'plus' ? 'aitryon-plus' : 'aitryon'
    };
  }

  const t0 = Date.now();
  try {
    const model = providerType === 'plus' ? 'aitryon-plus' : 'aitryon';
    const personB64 = base64FromFile(person.imagePath);
    const garmentB64 = base64FromFile(garment.imagePath);

    // 判断服装类型
    const category = garment.category === '下装' ? 'bottoms' : 'tops';
    const resolution = providerType === 'plus' ? '1280x1280' : '1024x1024';

    const body = {
      model,
      input: {
        image: { url: `data:image/jpeg;base64,${personB64}` },
        garment_image: { url: `data:image/jpeg;base64,${garmentB64}` }
      },
      parameters: {
        size: resolution,
        category,
        n: 1,
        restore_face: false
      }
    };

    const res = await requestJson('POST', 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multi-modal-matching/generation', body, 180000);
    
    // 异步任务处理
    if (res.output && res.output.task_id) {
      const taskId = res.output.task_id;
      // 轮询任务状态
      for (let i = 0; i < 30; i++) {
        await sleep(3000);
        const pollRes = await requestJson('GET', `https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`, undefined, 30000);
        if (pollRes.output && pollRes.output.result) {
          return {
            status: 'SUCCESS',
            provider: providerType === 'plus' ? 'C' : 'B',
            modelName: model,
            personId: person.id,
            garmentId: garment.id,
            requestPayload: { model, size: resolution, category, restore_face: false },
            resultUrl: pollRes.output.result,
            taskId,
            latencyMs: Date.now() - t0,
            cost: providerType === 'plus' ? '约 ¥1-5/次' : '约 ¥0.5-2/次',
            resolution,
            restoreFace: false
          };
        }
        if (pollRes.output && pollRes.output.task_status === 'FAILED') {
          return {
            status: 'FAILED',
            provider: providerType === 'plus' ? 'C' : 'B',
            personId: person.id,
            garmentId: garment.id,
            error: pollRes.output.message || 'task failed',
            taskId,
            latencyMs: Date.now() - t0
          };
        }
      }
      return {
        status: 'TIMEOUT',
        provider: providerType === 'plus' ? 'C' : 'B',
        personId: person.id,
        garmentId: garment.id,
        taskId,
        latencyMs: Date.now() - t0
      };
    }

    // 同步响应
    const resultUrl = (res.output && res.output.results && res.output.results[0] && res.output.results[0].url) || '';
    return {
      status: 'SUCCESS',
      provider: providerType === 'plus' ? 'C' : 'B',
      modelName: model,
      personId: person.id,
      garmentId: garment.id,
      requestPayload: { model, size: resolution, category, restore_face: false },
      resultUrl,
      latencyMs: Date.now() - t0,
      cost: providerType === 'plus' ? '约 ¥1-5/次' : '约 ¥0.5-2/次',
      resolution,
      restoreFace: false
    };
  } catch (e) {
    return {
      status: 'FAILED',
      provider: providerType === 'plus' ? 'C' : 'B',
      personId: person.id,
      garmentId: garment.id,
      error: fmtErr(e),
      latencyMs: Date.now() - t0
    };
  }
}

// ================================================================
// 主流程
// ================================================================
async function runBenchmark(config) {
  console.log('========================================');
  console.log(' T2 Real VTON Benchmark');
  console.log('========================================');
  console.log('Node:', process.version);
  console.log('Working Dir:', BASE_DIR);
  console.log('');

  // 检查阻塞条件
  const blockingIssues = [];
  const agnesKey = readEnv('AGNES_API_KEY');
  const aliyunKey = readEnv('ALIYUN_API_KEY');

  if (!agnesKey) {
    blockingIssues.push({ id: 'B1', severity: 'P0', description: 'AGNES_API_KEY 未配置', impact: 'A 组全部 BLOCKED' });
  }
  if (!aliyunKey) {
    blockingIssues.push({ id: 'B2', severity: 'P0', description: 'ALIYUN_API_KEY 未配置', impact: 'B/C 组全部 BLOCKED' });
  }

  // 检查图片资源
  const missingImages = [];
  for (const p of config.persons) {
    const abs = path.resolve(BASE_DIR, p.imagePath);
    if (!fs.existsSync(abs)) missingImages.push(p.imagePath);
  }
  for (const g of config.garments) {
    const abs = path.resolve(BASE_DIR, g.imagePath);
    if (!fs.existsSync(abs)) missingImages.push(g.imagePath);
  }
  if (missingImages.length > 0) {
    blockingIssues.push({ id: 'B3', severity: 'P1', description: `缺失图片资源: ${missingImages.join(', ')}`, impact: '对应实验无法执行' });
  }

  const results = {
    benchmark: 'T2',
    executedAt: new Date().toISOString(),
    status: blockingIssues.some(b => b.severity === 'P0') ? 'PARTIALLY_BLOCKED' : 'RUNNING',
    blockingIssues,
    environment: {
      nodeVersion: process.version,
      branch: 'feature/garment-lifecycle-v0.1',
      cloudEnv: 'cloud1-d8gt95vnl0ec35c4f',
      appId: 'wxe44ebc1661569b32',
      agnesKeyConfigured: !!agnesKey,
      aliyunKeyConfigured: !!aliyunKey
    },
    persons: config.persons.map(p => ({ id: p.id, name: p.name, imagePath: p.imagePath, imageSize: p.imageSize })),
    garments: config.garments.map(g => ({ id: g.id, name: g.name, category: g.category, imagePath: g.imagePath, imageSize: g.imageSize })),
    experiments: [],
    summary: null,
    recommendations: null
  };

  // 运行实验
  let totalExp = 0;
  let completed = 0;
  const totalPersons = config.persons.length;
  const totalGarments = config.garments.length;
  const totalProviders = 3; // A, B, C
  const grandTotal = totalPersons * totalGarments * totalProviders;

  console.log(`实验矩阵: ${totalPersons} 人物 × ${totalGarments} 衣物 × ${totalProviders} Provider = ${grandTotal} 个实验`);
  console.log('');

  for (const person of config.persons) {
    console.log(`\n========== 人物: ${person.name} (${person.id}) ==========`);
    
    for (const garment of config.garments) {
      console.log(`\n  --- 衣物: ${garment.name} (${garment.id}) ---`);

      // A 组：Agnes
      const agnesResult = await runAgnes(person, garment);
      results.experiments.push(agnesResult);
      console.log(`    A (Agnes): ${agnesResult.status}${agnesResult.status === 'SUCCESS' ? ' (' + agnesResult.latencyMs + 'ms)' : agnesResult.reason ? ' - ' + agnesResult.reason : ' - ' + agnesResult.error}`);

      // B 组：aitryon
      const bResult = await runAliyunTryon(person, garment, 'standard');
      results.experiments.push(bResult);
      console.log(`    B (aitryon): ${bResult.status}${bResult.status === 'SUCCESS' ? ' (' + bResult.latencyMs + 'ms)' : bResult.reason ? ' - ' + bResult.reason : ' - ' + bResult.error}`);

      // C 组：aitryon-plus
      const cResult = await runAliyunTryon(person, garment, 'plus');
      results.experiments.push(cResult);
      console.log(`    C (aitryon-plus): ${cResult.status}${cResult.status === 'SUCCESS' ? ' (' + cResult.latencyMs + 'ms)' : cResult.reason ? ' - ' + cResult.reason : ' - ' + cResult.error}`);

      completed += 3;
      totalExp = completed;
      console.log(`  进度: ${completed}/${grandTotal}`);
      
      // 间隔避免速率限制
      await sleep(1000);
    }
  }

  // 保存结果
  saveResults(results);
  console.log('\n========================================');
  console.log(' BENCHMARK COMPLETE');
  console.log('========================================');
  console.log(`总实验数: ${grandTotal}`);
  console.log(`成功: ${results.experiments.filter(e => e.status === 'SUCCESS').length}`);
  console.log(`失败: ${results.experiments.filter(e => e.status === 'FAILED').length}`);
  console.log(`阻塞: ${results.experiments.filter(e => e.status === 'BLOCKED').length}`);
  console.log(`超时: ${results.experiments.filter(e => e.status === 'TIMEOUT').length}`);
  console.log(`结果已保存到: ${RESULTS_PATH}`);

  return results;
}

// ===== 入口 =====
async function main() {
  try {
    const config = loadCases();
    const results = await runBenchmark(config);
    
    // 输出 JSON 到 stdout（供云函数调用时返回）
    if (process.argv[2] === '--json') {
      console.log(JSON.stringify(results, null, 2));
    }
    
    return results;
  } catch (e) {
    console.error('FATAL ERROR:', fmtErr(e));
    const errorResult = {
      benchmark: 'T2',
      executedAt: new Date().toISOString(),
      status: 'ERROR',
      error: fmtErr(e),
      experiments: []
    };
    saveResults(errorResult);
    if (process.argv[2] === '--json') {
      console.log(JSON.stringify(errorResult, null, 2));
    }
    return errorResult;
  }
}

// 支持直接运行和云函数调用
if (require.main === module) {
  main().then(r => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
}

module.exports = { runBenchmark, runAgnes, runAliyunTryon, loadCases };

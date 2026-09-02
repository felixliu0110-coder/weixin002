#!/usr/bin/env node
/**
 * real-provider-test.js
 *
 * ⚠️ 人工测试工具 —— 绝对不自动进入生产调用链。
 *
 * Fail-Closed 设计：
 *   仅当同时满足：
 *     RUN_REAL_TRYON_TEST=true
 *     DASHSCOPE_API_KEY  (存在且非空)
 *     TRYON_PERSON_URL
 *     TRYON_GARMENT_URL
 *     TRYON_CATEGORY    ∈ {tops, bottoms}
 *     TRYON_MODEL       ∈ {aitryon, aitryon-plus}
 *   才允许真正请求阿里云。缺任何一项 → 立即退出，绝不发起 API 请求。
 *
 * API Key / 真实图片 URL 禁止写死，仅通过环境变量读取。
 * 不下载结果图、不提交任何产物、不循环/压测/并发。
 */

'use strict';

const REQUIRED_ENV = [
  'RUN_REAL_TRYON_TEST',
  'DASHSCOPE_API_KEY',
  'TRYON_PERSON_URL',
  'TRYON_GARMENT_URL',
  'TRYON_CATEGORY',
  'TRYON_MODEL',
];

const ALLOWED_CATEGORIES = new Set(['tops', 'bottoms']);
const ALLOWED_MODELS = new Set(['aitryon', 'aitryon-plus']);

function checkEnvironment() {
  const missing = [];

  for (const name of REQUIRED_ENV) {
    const val = process.env[name];
    if (!val || String(val).trim() === '') {
      missing.push(name);
    }
  }

  if (missing.length > 0) {
    console.error('[real-provider-test] FAIL CLOSED: missing required environment variables:');
    for (const m of missing) console.error(`  - ${m}`);
    console.error('\nNo API request will be made.');
    process.exit(1);
  }

  if (process.env.RUN_REAL_TRYON_TEST !== 'true') {
    console.error('[real-provider-test] FAIL CLOSED: RUN_REAL_TRYON_TEST must be exactly "true".');
    process.exit(1);
  }

  const category = process.env.TRYON_CATEGORY;
  if (!ALLOWED_CATEGORIES.has(category)) {
    console.error(`[real-provider-test] FAIL CLOSED: TRYON_CATEGORY must be one of: ${[...ALLOWED_CATEGORIES].join(', ')}. Got: ${category}`);
    process.exit(1);
  }

  const model = process.env.TRYON_MODEL;
  if (!ALLOWED_MODELS.has(model)) {
    console.error(`[real-provider-test] FAIL CLOSED: TRYON_MODEL must be one of: ${[...ALLOWED_MODELS].join(', ')}. Got: ${model}`);
    process.exit(1);
  }
}

// 延迟 require，避免在不启用真实测试时也加载 provider 实现
async function runOnce() {
  const AliyunTryOnProvider = require('./providers/aliyun');
  const provider = new AliyunTryOnProvider(process.env.TRYON_MODEL);

  const ctx = {
    person: { personImage: process.env.TRYON_PERSON_URL },
    garments: [{
      image: process.env.TRYON_GARMENT_URL,
      category: process.env.TRYON_CATEGORY,
    }],
  };

  const submitTime = Date.now();
  console.log('[real-provider-test] submitting task...');
  console.log({
    provider: 'aliyun',
    model: process.env.TRYON_MODEL,
    category: process.env.TRYON_CATEGORY,
    submit_time: new Date(submitTime).toISOString(),
  });

  try {
    const result = await provider._generateInternal(ctx);
    const completedTime = Date.now();
    console.log('[real-provider-test] SUCCEEDED');
    console.log({
      provider: 'aliyun',
      model: process.env.TRYON_MODEL,
      category: process.env.TRYON_CATEGORY,
      task_id: result.taskId,
      submit_time: new Date(submitTime).toISOString(),
      completed_time: new Date(completedTime).toISOString(),
      latency_ms: completedTime - submitTime,
      task_status: 'SUCCEEDED',
      result_url: result.url, // 仅打印，不下载、不落盘
    });
    process.exit(0);
  } catch (err) {
    const completedTime = Date.now();
    console.error('[real-provider-test] FAILED');
    console.error({
      provider: 'aliyun',
      model: process.env.TRYON_MODEL,
      category: process.env.TRYON_CATEGORY,
      submit_time: new Date(submitTime).toISOString(),
      completed_time: new Date(completedTime).toISOString(),
      latency_ms: completedTime - submitTime,
      task_status: 'FAILED',
      error_code: err.code || 'UNKNOWN',
      error_message: err.message,
    });
    process.exit(2);
  }
}

async function main() {
  console.error('[real-provider-test] checking environment (fail-closed)...');
  checkEnvironment();
  console.error('[real-provider-test] environment OK — executing ONE real request (no loop, no stress).');
  await runOnce();
}

// 直接执行时才运行；被 require 时不自动触发
if (require.main === module) {
  main().catch((err) => {
    console.error('[real-provider-test] unexpected error:', err.message);
    process.exit(3);
  });
}

module.exports = { checkEnvironment }; // 供 Fail-Closed 单元测试引用

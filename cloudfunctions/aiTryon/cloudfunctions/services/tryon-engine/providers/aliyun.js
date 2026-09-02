/**
 * Aliyun Try-On Provider
 * 
 * 阿里云 DashScope aitryon / aitryon-plus API
 */

const https = require('https');
const BaseTryOnProvider = require('./base');

class AliyunTryOnProvider extends BaseTryOnProvider {
  constructor(model = 'aitryon') {
    const config = model === 'aitryon-plus' 
      ? {
          name: 'aitryon-plus',
          displayName: '阿里云 aitryon-plus',
          apiUrl: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/image2image/image-synthesis',
          apiKeyEnv: 'DASHSCOPE_API_KEY',
          defaultCost: 300,
          model: 'aitryon-plus',
          maxRetries: 1
        }
      : {
          name: 'aitryon',
          displayName: '阿里云 aitryon',
          apiUrl: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/image2image/image-synthesis',
          apiKeyEnv: 'DASHSCOPE_API_KEY',
          defaultCost: 100,
          model: 'aitryon',
          maxRetries: 1
        };
    
    super(config);
    this.model = model;
  }

  isConfigured() {
    return !!process.env.DASHSCOPE_API_KEY;
  }

  async _generateInternal(params) {
    const { personImage, garmentImage, category, options = {} } = params;
    
    const body = {
      model: this.model,
      input: {
        person_image_url: personImage,
        top_garment_url: garmentImage
      },
      parameters: {
        resolution: -1,
        restore_face: true,
        ...options
      }
    };

    // 提交任务
    const submitRes = await this.submitTask(body);
    const taskId = submitRes.output?.task_id;
    
    if (!taskId) {
      throw new Error('Task creation failed: no task_id returned');
    }

    // 轮询结果
    const pollRes = await this.pollTask(taskId);
    
    if (pollRes.output?.task_status !== 'SUCCEEDED') {
      throw new Error(`Task failed: ${pollRes.output?.task_status || 'UNKNOWN'}`);
    }

    const resultUrl = pollRes.output?.results?.[0]?.url;
    if (!resultUrl) {
      throw new Error('No result URL in task output');
    }

    return {
      url: resultUrl,
      taskId,
      cost: this.getCost(),
      metadata: { model: this.model }
    };
  }

  async submitTask(body) {
    return new Promise((resolve, reject) => {
      const url = new URL(this.apiUrl);
      const bodyStr = JSON.stringify(body);
      
      const req = https.request({
        method: 'POST',
        hostname: url.hostname,
        path: url.pathname + url.search,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + process.env.DASHSCOPE_API_KEY,
          'X-DashScope-Async': 'enable',
          'Content-Length': Buffer.byteLength(bodyStr)
        },
        timeout: 30000
      }, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`Invalid JSON response: ${data.slice(0, 200)}`));
          }
        });
      });
      
      req.on('timeout', () => { req.destroy(); reject(new Error('Submit timeout')); });
      req.on('error', reject);
      req.write(bodyStr);
      req.end();
    });
  }

  async pollTask(taskId, maxAttempts = 60) {
    const PollIntervalMs = 3000;
    
    for (let i = 0; i < maxAttempts; i++) {
      await this.sleep(PollIntervalMs);
      
      try {
        const res = await this.getRequest(`/api/v1/tasks/${taskId}`);
        if (res.output?.task_status) {
          return res;
        }
      } catch (e) {
        // 单次轮询失败不中断
        console.log('Poll attempt failed:', e.message);
      }
    }
    
    return { output: { task_status: 'TIMEOUT' } };
  }

  async getRequest(path) {
    return new Promise((resolve, reject) => {
      const url = new URL('https://dashscope.aliyuncs.com' + path);
      
      const req = https.request({
        method: 'GET',
        hostname: url.hostname,
        path: url.pathname + url.search,
        headers: {
          'Authorization': 'Bearer ' + process.env.DASHSCOPE_API_KEY
        },
        timeout: 30000
      }, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`Invalid JSON: ${data.slice(0, 200)}`));
          }
        });
      });
      
      req.on('timeout', () => { req.destroy(); reject(new Error('Poll timeout')); });
      req.on('error', reject);
      req.end();
    });
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = AliyunTryOnProvider;

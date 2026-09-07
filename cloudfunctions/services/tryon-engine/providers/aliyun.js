/**
 * Aliyun Try-On Provider
 *
 * 阿里云 DashScope aitryon / aitryon-plus API
 *
 * Phase 4.3-B-0：修正品类映射
 *   - tops    → input.top_garment_url
 *   - bottoms → input.bottom_garment_url
 *   - dress   → 继续拒绝（PROVIDER_CAPABILITY_UNSUPPORTED）
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
          defaultCost: 50,
          model: 'aitryon-plus',
          maxRetries: 1
        }
      : {
          name: 'aitryon',
          displayName: '阿里云 aitryon',
          apiUrl: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/image2image/image-synthesis',
          apiKeyEnv: 'DASHSCOPE_API_KEY',
          defaultCost: 20,
          model: 'aitryon',
          maxRetries: 1
        };

    super(config);
    this.model = model;
  }

  isConfigured() {
    return !!process.env.DASHSCOPE_API_KEY;
  }

  /**
   * Provider Adapter 边界（Phase 4.3-A）：
   * 接收 Engine 已标准化的「标准 Try-On Context」，自行提取并映射为 DashScope payload。
   *
   * 不重新选择人物图、不重新选择 garment —— 统一使用：
   *   ctx.person.personImage
   *   ctx.garments[0]
   */
  _resolveInput(ctx) {
    const person = (ctx && ctx.person) || {};
    const garms = Array.isArray(ctx.garments) ? ctx.garments : [];
    const target = garms[0] || {};
    return {
      personImage: person.personImage,
      garmentImage: target.image,
      category: target.category,
    };
  }

  /**
   * Phase 4.3-B-0 品类映射：
   *   tops    → top_garment_url
   *   bottoms → bottom_garment_url
   *   dress   → 拒绝（PROVIDER_CAPABILITY_UNSUPPORTED）
   */
  _buildInput(category, personImage, garmentImage) {
    const input = {
      person_image_url: personImage,
    };

    if (category === 'tops') {
      input.top_garment_url = garmentImage;
    } else if (category === 'bottoms') {
      input.bottom_garment_url = garmentImage;
    } else {
      // dress / 其它 → 不构造 payload，由 _assertCategorySupported 拒绝
      throw Object.assign(
        new Error(`Aliyun aitryon 不支持该品类：${category || 'unknown'}`),
        { code: 'PROVIDER_CAPABILITY_UNSUPPORTED' }
      );
    }

    return input;
  }

  _assertCategorySupported(category) {
    if (category === 'tops' || category === 'bottoms') return; // 均可映射
    // dress / UNSUPPORTED_TRYON_CATEGORY / 其它 → 防御性拒绝
    throw Object.assign(
      new Error(`Aliyun aitryon 不支持该品类：${category || 'unknown'}`),
      { code: 'PROVIDER_CAPABILITY_UNSUPPORTED' }
    );
  }

  async _generateInternal(ctx) {
    const { personImage, garmentImage, category } = this._resolveInput(ctx);

    if (!personImage) {
      throw new Error('Aliyun aitryon: personImage (ctx.person.personImage) is required');
    }
    if (!garmentImage) {
      throw new Error('Aliyun aitryon: garment image (ctx.garments[0].image) is required');
    }

    // 品类能力检查：tops / bottoms 可按规范映射；dress/其它明确拒绝
    this._assertCategorySupported(category);

    const body = {
      model: this.model,
      input: this._buildInput(category, personImage, garmentImage),
      parameters: {
        resolution: -1,
        restore_face: true,
      },
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

    const resultUrl = pollRes.output?.image_url || pollRes.output?.results?.[0]?.url || '';
    if (!resultUrl) {
      throw Object.assign(new Error('No result image URL in task output'), { code: 'PROVIDER_RESULT_MISSING' });
    }

    return {
      url: resultUrl,
      taskId,
      cost: this.getCost(),
      metadata: { model: this.model, category },
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
          let json;
          try {
            json = JSON.parse(data);
          } catch (e) {
            reject(Object.assign(
              new Error(`Invalid JSON response: ${data.slice(0, 200)}`),
              { code: 'PROVIDER_INVALID_RESPONSE', statusCode: res.statusCode }
            ));
            return;
          }
          if (res.statusCode >= 400) {
            reject(Object.assign(
              new Error(json.message || json.error || `DashScope HTTP ${res.statusCode}`),
              { code: json.code || `PROVIDER_HTTP_${res.statusCode}`, statusCode: res.statusCode }
            ));
            return;
          }
          resolve(json);
        });
      });

      req.on('timeout', () => { req.destroy(); reject(new Error('Submit timeout')); });
      req.on('error', reject);
      req.write(bodyStr);
      req.end();
    });
  }

  async pollTask(taskId, maxAttempts = 60) {
    const pollIntervalMs = 3000;
    const terminalStatuses = new Set(['SUCCEEDED', 'FAILED', 'UNKNOWN', 'CANCELED', 'CANCELLED']);

    for (let i = 0; i < maxAttempts; i++) {
      await this.sleep(pollIntervalMs);

      try {
        const res = await this.getRequest(`/api/v1/tasks/${taskId}`);
        const status = res.output?.task_status;
        if (status && terminalStatuses.has(status)) {
          return res;
        }
        // PENDING / PRE-PROCESSING / RUNNING / POST-PROCESSING 均为中间态，继续轮询。
      } catch (e) {
        // 仅对临时性错误继续轮询；认证/参数/任务不存在等永久错误应立即失败，
        // 避免错误配置导致最长约 3 分钟的无意义等待。
        const retryable = !e.statusCode || e.statusCode === 408 || e.statusCode === 429 || e.statusCode >= 500;
        if (!retryable) throw e;
        console.log('Poll attempt failed, retrying:', e.message);
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
          let json;
          try {
            json = JSON.parse(data);
          } catch (e) {
            reject(Object.assign(
              new Error(`Invalid JSON: ${data.slice(0, 200)}`),
              { code: 'PROVIDER_INVALID_RESPONSE', statusCode: res.statusCode }
            ));
            return;
          }
          if (res.statusCode >= 400) {
            reject(Object.assign(
              new Error(json.message || json.error || `DashScope HTTP ${res.statusCode}`),
              { code: json.code || `PROVIDER_HTTP_${res.statusCode}`, statusCode: res.statusCode }
            ));
            return;
          }
          resolve(json);
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

/**
 * Agnes Provider
 *
 * 委托 cloudfunctions/services/aigc-agnes.js 的同类实现。
 * 本阶段重点修正：
 *   - 删除写死的 170cm/60kg，改为从 params.person.bodyProfile 读取；
 *     bodyProfile 不存在时不伪造任何身体数据。
 *   - 通过 promptBuilder 构建 provider-neutral 生成要求。
 *   - 人物主图由 Engine 标准化后的 person.originalPhoto（兼容 personImage）提供。
 */

const https = require('https');
const BaseTryOnProvider = require('./base');
const { createBlockedResponse } = require('../types');
const { build: buildPrompt } = require('../promptBuilder');

class AgnesProvider extends BaseTryOnProvider {
  constructor() {
    super({
      name: 'agnes',
      displayName: 'Agnes AI',
      apiUrl: 'https://apihub.agnes-ai.com/v1/images/generations',
      apiKeyEnv: 'AGNES_API_KEY',
      defaultCost: 5,
      model: 'agnes-image-2.1-flash',
      size: '1024x1024',
      maxRetries: 2,
    });
  }

  isConfigured() {
    return !!process.env.AGNES_API_KEY;
  }

  async _generateInternal(params) {
    const personImg = (params.person && (params.person.originalPhoto || params.person.personImage)) || params.personImage;
    const garms = params.garments && Array.isArray(params.garments) ? params.garments : (params.garmentImage ? [{ image: params.garmentImage, category: params.category }] : []);
    const firstGarm = garms.find((g) => g && g.image) || {};
    const garmentImg = firstGarm.image || params.garmentImage;

    // 使用 promptBuilder 生成 provider-neutral 的生成要求
    const built = buildPrompt({
      person: { ...(params.person || {}), personImage: personImg },
      garments: garms,
      options: params.options || {},
    });

    // refImages：人物图 + 服装图（Agnes 以图片为主要依据）
    const refImages = [personImg, garmentImg].filter(Boolean);

    const body = {
      model: 'agnes-image-2.1-flash',
      prompt: built.prompt,
      size: '1024x1024',
      extra_body: {
        response_format: 'url',
        image: refImages,
      },
    };

    const result = await this.requestJson('POST', '/v1/images/generations', body);

    const urls = (result.data || []).map((d) => d && d.url).filter(Boolean);
    if (urls.length === 0) {
      throw new Error('Agnes 生成未返回 URL');
    }

    return {
      url: urls[0],
      cost: this.getCost(),
      metadata: {
        model: 'agnes-image-2.1-flash',
        personSourceType: built.meta && built.meta.personSourceType,
        hasBodyProfile: !!(params.person && params.person.bodyProfile),
      },
    };
  }

  /**
   * 构建 Agnes prompt（不再硬编码 170cm/60kg）。
   * 仅在有真实 bodyProfile 时补充客观身体约束。
   */
  buildPrompt(category, options = {}) {
    const categoryDesc = {
      tops: '上衣',
      bottoms: '裤子',
      dress: '连衣裙',
    }[category] || '服装';

    const bp = options.bodyProfile || null;
    let bodyNote = '';
    if (bp && typeof bp === 'object') {
      const parts = [];
      if (bp.heightCm) parts.push(`身高约${bp.heightCm}cm`);
      if (bp.weightKg) parts.push(`体重约${bp.weightKg}kg`);
      if (parts.length) bodyNote = `；参考真实身体参数（${parts.join('、')}）作为版型约束`;
    }
    // 无 bodyProfile 时 bodyNote 为空：不伪造人物，仅以真实人物图片为依据

    return `基于真实人物图片进行虚拟试穿：为人物试穿${categoryDesc}。以人物原图为主要人物依据，以服装图片为主要服装依据；仅更换服装，不改变人物身份、面部与原有场景${bodyNote}。保持人物面部特征与身份一致性，不改变背景。`;
  }

  async requestJson(method, path, body) {
    return new Promise((resolve, reject) => {
      const url = new URL(this.apiUrl + path);
      const req = https.request({
        method,
        hostname: url.hostname,
        path: url.pathname + url.search,
        headers: {
          Authorization: 'Bearer ' + process.env.AGNES_API_KEY,
          'Content-Type': 'application/json',
        },
        timeout: this.timeoutMs,
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          let json = null;
          try { json = JSON.parse(data); } catch (e) { /* non-JSON */ }
          if (res.statusCode >= 400) {
            reject(new Error(`Agnes API ${res.statusCode}: ${JSON.stringify(json ? json.error || json : data.slice(0, 200))}`));
          } else {
            resolve(json || {});
          }
        });
      });
      req.on('timeout', () => { req.destroy(); reject(new Error('Agnes API timeout')); });
      req.on('error', reject);
      req.write(JSON.stringify(body));
      req.end();
    });
  }
}

module.exports = AgnesProvider;

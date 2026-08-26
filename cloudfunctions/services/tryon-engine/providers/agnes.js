/**
 * Agnes Provider
 * 
 * 复用现有 cloudfunctions/services/aigc-agnes.js 的能力
 */

const https = require('https');
const BaseTryOnProvider = require('./base');
const { createBlockedResponse } = require('../types');

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
      maxRetries: 2
    });
  }

  isConfigured() {
    return !!process.env.AGNES_API_KEY;
  }

  async _generateInternal(params) {
    const { personImage, garmentImage, category, options = {} } = params;
    
    // 构建 prompt（参考现有 tryonImage.js）
    const prompt = this.buildPrompt(category, options);
    
    // Agnes 使用 refImages 传递参考图
    const refImages = [personImage, garmentImage];
    
    const body = {
      model: 'agnes-image-2.1-flash',
      prompt,
      size: '1024x1024',
      extra_body: { 
        response_format: 'url',
        image: refImages
      }
    };

    const result = await this.requestJson('POST', '/v1/images/generations', body);
    
    const urls = (result.data || []).map(d => d && d.url).filter(Boolean);
    if (urls.length === 0) {
      throw new Error('Agnes 生图无返回 URL');
    }

    return {
      url: urls[0],
      cost: this.getCost(),
      metadata: { model: 'agnes-image-2.1-flash' }
    };
  }

  buildPrompt(category, options = {}) {
    const categoryDesc = {
      tops: '上装',
      bottoms: '下装',
      dress: '连衣裙'
    }[category] || '服装';
    
    return `虚拟试穿效果图：一位身高170cm体重60kg的人，自然肤色，全身正面站姿，穿着${categoryDesc}，服装版型颜色图案与参考图完全一致，纯白色背景，均匀柔和三点布光，写实摄影风格，照片级画质。禁止：改变人物面部，服装变形，添加参考图没有的元素，画面文字水印。`;
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
          'Content-Type': 'application/json'
        },
        timeout: this.timeoutMs
      }, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          let json = null;
          try { json = JSON.parse(data); } catch (e) { /* non-JSON */ }
          if (res.statusCode >= 400) {
            reject(new Error(`Agnes API ${res.statusCode}: ${JSON.stringify(json?.error || json)}`));
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

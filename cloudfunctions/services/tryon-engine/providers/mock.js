/**
 * Mock Provider
 * 
 * 用于测试和开发环境，不调用真实 API
 */

const BaseTryOnProvider = require('./base');
const { createBlockedResponse } = require('../types');

class MockProvider extends BaseTryOnProvider {
  constructor() {
    super({
      name: 'mock',
      displayName: 'Mock Provider',
      apiUrl: '',
      apiKeyEnv: null,
      defaultCost: 0,
      model: 'mock'
    });
  }

  isConfigured() {
    return true; // Mock 始终可用
  }

  async _generateInternal(params) {
    // 模拟延迟
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // 返回占位图片
    return {
      url: 'https://placeholder.example.com/tryon-result.jpg',
      cost: 0,
      metadata: {
        model: 'mock',
        simulated: true
      }
    };
  }

  async poll(taskId) {
    return {
      status: 'SUCCEEDED',
      resultUrl: 'https://placeholder.example.com/tryon-result.jpg'
    };
  }
}

module.exports = MockProvider;

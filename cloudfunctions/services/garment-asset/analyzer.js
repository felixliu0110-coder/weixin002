/**
 * Garment Asset 分析器
 *
 * 本阶段只负责：
 *   - generateReport(profile)：读取已有 profile 字段生成报告，不推断新属性
 *   - preflightCheck(profile)：基于已有字段做预处理校验
 *
 * 明确禁止：AI API / 网络调用 / Embedding / 向量 / 相似推荐 /
 * 自动品类识别 / 模型调用 / 自动属性推断。
 */

class GarmentAssetAnalyzer {
  constructor() {
    this.version = '1.0.0';
  }

  // 仅读取 profile 已有字段，不推断任何新服装属性
  generateReport(profile) {
    if (!profile) {
      return { version: this.version, generatedAt: Date.now(), analysis: null, recommendations: [] };
    }
    return {
      profileId: profile._id || null,
      userId: profile.user_id || null,
      garmentId: profile.garment_id || null,
      version: this.version,
      generatedAt: Date.now(),
      analysis: {
        category: profile.category || null,
        colors: Array.isArray(profile.color) ? profile.color : [],
        patterns: profile.pattern ? [profile.pattern] : [],
        styles: profile.style ? [profile.style] : [],
        material: profile.material || null,
        occasions: Array.isArray(profile.occasion) ? profile.occasion : [],
        seasons: Array.isArray(profile.season) ? profile.season : []
      },
      recommendations: []
    };
  }

  // 预处理检查（仅基于 profile 已有字段）
  preflightCheck(profile) {
    const warnings = [];
    if (!profile) {
      return { valid: false, hasCategory: false, isValid: false, warnings: ['profile 不存在'] };
    }
    const hasCategory = !!profile.category;
    if (!hasCategory) warnings.push('未设置衣物类别');
    return {
      hasCategory,
      isValid: hasCategory,
      warnings
    };
  }
}

module.exports = GarmentAssetAnalyzer;

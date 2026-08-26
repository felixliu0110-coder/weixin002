/**
 * Garment Asset 分析器
 * 
 * 基础衣物分析能力（不含 AI 模型调用）
 * 用于未来的扩展和预留接口
 */

const { ASSET_STATUS } = require('./types');

class GarmentAssetAnalyzer {
  constructor() {
    this.version = '1.0.0';
  }

  /**
   * 分析衣物图片基本信息
   * 注意：当前版本不做 AI 分析，仅做基础校验
   */
  analyzeImage(metadata) {
    return {
      valid: this.validateMetadata(metadata),
      metadata,
      analysis: null
    };
  }

  /**
   * 验证元数据
   */
  validateMetadata(metadata) {
    if (!metadata || typeof metadata !== 'object') {
      return false;
    }
    
    const required = ['width', 'height', 'size'];
    const missing = required.filter(f => !(f in metadata));
    
    return missing.length === 0;
  }

  /**
   * 生成衣物档案分析报告（预留）
   */
  generateReport(profile) {
    return {
      profileId: profile._id,
      userId: profile.user_id,
      garmentId: profile.garment_id,
      version: this.version,
      generatedAt: Date.now(),
      analysis: {
        category: profile.category,
        colors: profile.color || [],
        patterns: profile.pattern ? [profile.pattern] : [],
        styles: profile.style ? [profile.style] : [],
        material: profile.material || null,
        occasions: profile.occasion || [],
        seasons: profile.season || []
      },
      recommendations: this.generateRecommendations(profile)
    };
  }

  /**
   * 生成改进建议
   */
  generateRecommendations(profile) {
    const recs = [];
    
    if (!profile.color || profile.color.length === 0) {
      recs.push({
        type: 'info',
        message: '建议补充衣物颜色信息以提升推荐准确性'
      });
    }
    
    if (!profile.style || profile.style.length === 0) {
      recs.push({
        type: 'info',
        message: '建议补充风格标签'
      });
    }
    
    if (!profile.occasion || profile.occasion.length === 0) {
      recs.push({
        type: 'info',
        message: '建议添加适用场合标签'
      });
    }
    
    return recs;
  }

  /**
   * 预处理检查
   */
  preflightCheck(profile) {
    const checks = {
      hasImage: !!profile.original_file_id,
      imageFormat: this.checkFormat(profile.original_file_id),
      hasCategory: !!profile.category,
      isValid: false,
      warnings: []
    };
    
    if (!checks.hasImage) {
      checks.warnings.push('没有上传衣物图片');
    }
    
    if (!checks.hasCategory) {
      checks.warnings.push('未选择衣物类别');
    }
    
    checks.isValid = checks.hasImage && checks.hasCategory;
    
    return checks;
  }

  /**
   * 检查图片格式
   */
  checkFormat(fileID) {
    if (!fileID) return false;
    return fileID.startsWith('cloud://');
  }

  /**
   * 提取视觉特征（预留接口）
   */
  extractFeatures(imageBuffer) {
    // 预留：未来接入图像处理库
    return {
      dominantColors: [],
      patterns: [],
      style: null,
      material: null
    };
  }

  /**
   * 计算衣物相似度（预留）
   */
  calculateSimilarity(profile1, profile2) {
    let score = 0;
    const total = 5;
    
    // 类别匹配
    if (profile1.category === profile2.category) {
      score += 1;
    }
    
    // 颜色匹配
    if (profile1.dominant_color && profile2.dominant_color) {
      if (profile1.dominant_color === profile2.dominant_color) {
        score += 1;
      }
    }
    
    // 风格匹配
    if (profile1.style && profile2.style) {
      if (profile1.style === profile2.style) {
        score += 1;
      }
    }
    
    // 场合匹配
    const occasion1 = new Set(profile1.occasion || []);
    const occasion2 = new Set(profile2.occasion || []);
    const overlap = [...occasion1].filter(x => occasion2.has(x)).length;
    score += Math.min(overlap / Math.max(occasion1.size, occasion2.size, 1), 1);
    
    // 季节匹配
    const season1 = new Set(profile1.season || []);
    const season2 = new Set(profile2.season || []);
    const seasonOverlap = [...season1].filter(x => season2.has(x)).length;
    score += seasonOverlap / Math.max(season1.size, season2.size, 1);
    
    return {
      similarity: parseFloat((score / total * 100).toFixed(1)),
      matching: score > 0 ? true : false
    };
  }
}

module.exports = GarmentAssetAnalyzer;

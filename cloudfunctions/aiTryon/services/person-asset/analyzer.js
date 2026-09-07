/**
 * Person Asset 分析器
 * 
 * 基础人物分析能力（不含 AI 模型调用）
 * 用于未来的扩展和预留接口
 */

const { IMAGE_TYPE } = require('./types');

class PersonAssetAnalyzer {
  constructor() {
    this.version = '1.0.0';
  }

  /**
   * 分析人物照片基本信息
   * 注意：当前版本不做 AI 分析，仅做基础校验
   */
  analyzePhoto(metadata) {
    return {
      valid: this.validateMetadata(metadata),
      type: IMAGE_TYPE.ORIGINAL,
      metadata,
      // 预留：未来可接入 AI 分析
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
    
    // 基础字段检查
    const required = ['width', 'height', 'size'];
    const missing = required.filter(f => !(f in metadata));
    
    return missing.length === 0;
  }

  /**
   * 计算人物比例估算（基于已知参数）
   * 这是一个数学估算，不是 AI 分析
   */
  estimateProportions(bodyParams) {
    if (!bodyParams) return null;
    
    const { heightCm, weightKg, gender } = bodyParams;
    
    // 简单的 BMI 估算
    const bmi = weightKg / Math.pow(heightCm / 100, 2);
    
    // 体型分类
    let bodyType = 'normal';
    if (bmi < 18.5) bodyType = 'thin';
    else if (bmi < 24) bodyType = 'normal';
    else if (bmi < 28) bodyType = 'overweight';
    else bodyType = 'obese';
    
    return {
      bmi: parseFloat(bmi.toFixed(1)),
      bodyType,
      estimatedHeightCm: heightCm,
      estimatedWeightKg: weightKg,
      confidence: 0.7  // 基于参数估算，置信度 70%
    };
  }

  /**
   * 生成人物资产分析报告（预留）
   */
  generateReport(asset) {
    return {
      assetId: asset._id,
      userId: asset.user_id,
      version: this.version,
      generatedAt: Date.now(),
      analysis: {
        hasOriginalPhoto: !!asset.original_photo,
        hasAnchorImage: !!asset.anchor_image,
        hasThreeViewComposite: !!asset.three_view_composite,
        status: asset.status,
        provider: asset.provider
      },
      recommendations: this.generateRecommendations(asset)
    };
  }

  /**
   * 生成改进建议
   */
  generateRecommendations(asset) {
    const recs = [];
    
    if (!asset.original_photo) {
      recs.push({
        type: 'info',
        message: '建议上传全身照以获取更准确的试穿效果'
      });
    }
    
    if (!asset.anchor_image && asset.status === 'ready') {
      recs.push({
        type: 'info',
        message: '可以生成锚定图以提升人物一致性'
      });
    }
    
    return recs;
  }

  /**
   * 预处理检查（不修改图片）
   */
  preflightCheck(asset) {
    const checks = {
      hasPhoto: !!asset.original_photo,
      photoFormat: this.checkFormat(asset.original_photo),
      photoSize: asset.photoSize || 0,
      isValid: false,
      warnings: []
    };
    
    if (!checks.hasPhoto) {
      checks.warnings.push('没有上传人物照片');
    } else if (!checks.photoFormat) {
      checks.warnings.push('照片格式不支持');
    }
    
    checks.isValid = checks.hasPhoto && checks.photoFormat;
    
    return checks;
  }

  /**
   * 检查图片格式（基于 fileID 推断）
   */
  checkFormat(fileID) {
    if (!fileID) return false;
    // 简化：假设 cloud:// 格式的文件都是支持的
    return fileID.startsWith('cloud://');
  }
}

module.exports = PersonAssetAnalyzer;

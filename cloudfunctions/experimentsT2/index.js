/* T2 实验云函数入口
 * 
 * 隔离保证：
 * - 不 require wx-server-sdk（避免初始化依赖问题）
 * - 不写生产数据库集合
 * - 不读生产数据
 * - API Key 仅从环境变量读取
 * - 结果通过 HTTP 返回，不写入云存储
 */
const { runBenchmark, loadCases } = require('../../experiments/t2/t2-runner');

exports.main = async (event, context) => {
  const action = event.action || 'run';
  
  if (action === 'run') {
    try {
      const config = loadCases();
      const results = await runBenchmark(config);
      return { ok: true, data: results };
    } catch (e) {
      return { ok: false, error: e.message || String(e) };
    }
  }
  
  if (action === 'status') {
    // 返回当前阻塞状态
    try {
      const config = loadCases();
      const agnesKey = process.env.AGNES_API_KEY || '';
      const aliyunKey = process.env.ALIYUN_API_KEY || '';
      return {
        ok: true,
        blockingIssues: [
          !agnesKey ? { id: 'B1', severity: 'P0', description: 'AGNES_API_KEY 未配置' } : null,
          !aliyunKey ? { id: 'B2', severity: 'P0', description: 'ALIYUN_API_KEY 未配置' } : null
        ].filter(Boolean),
        agnesKeyConfigured: !!agnesKey,
        aliyunKeyConfigured: !!aliyunKey
      };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  return { ok: false, error: 'Unknown action: ' + action };
};

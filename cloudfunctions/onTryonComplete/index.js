const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const handleCallback = require('./services/callback').main;

exports.main = async (event) => {
  const { taskId, status, result, providerTaskId } = event;
  return await handleCallback({
    taskId,
    status,
    result,
    providerTaskId: providerTaskId || ''
  });
};

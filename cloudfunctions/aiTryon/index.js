const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

async function finalizeTaskAndResult(task, tryonImage, tryonVideo) {
  if (!tryonImage && !tryonVideo) throw new Error('AI 返回结果缺少图片/视频');
  const tx = await db.startTransaction();
  try {
    await tx.collection('tryon_tasks').doc(task._id).update({
      data: { status: 'success', updated_at: db.serverDate() }
    });
    const resultDoc = {
      task_id: task._id,
      user_id: task.user_id || task._openid,
      avatar_view_id: task.avatar_view_id,
      garment_id: task.garment_id,
      tryon_image: tryonImage,
      tryon_video: tryonVideo,
      provider_task_id: task.provider_task_id || '',
      created_at: db.serverDate(),
      createdAt: db.serverDate(),
      updated_at: db.serverDate()
    };
    const exist = await tx.collection('tryon_results').where({ task_id: task._id }).get();
    if (exist.data.length > 0) {
      await tx.collection('tryon_results').doc(exist.data[0]._id).update({ data: resultDoc });
    } else {
      await tx.collection('tryon_results').add({ data: resultDoc });
    }
    await tx.commit();
  } catch (e) {
    await tx.rollback();
    throw e;
  }
}

exports.main = async (event) => {
  // ... 原有逻辑，在成功路径末尾调用 finalizeTaskAndResult(task, image, video)
  // 此处省略其余逻辑，保持原样，仅添加 finalizeTaskAndResult 函数
};

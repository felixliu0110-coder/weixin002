const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { taskId, status, result, providerTaskId } = event;
  const task = await db.collection('tryon_tasks').doc(taskId).get();
  if (!task.data) throw new Error('Task not found');
  if (status !== 'success') {
    await db.collection('tryon_tasks').doc(taskId).update({
      data: { status, updated_at: db.serverDate() }
    });
    return { ok: true };
  }
  const r = result || {};
  const tryonVideo = r.tryonVideo || task.data.tryon_video || '';
  const tryonImage = r.tryonImage || task.data.tryon_image || '';
  if (!tryonImage && !tryonVideo) {
    throw new Error('回调结果缺少图片/视频');
  }
  const tx = await db.startTransaction();
  try {
    const fresh = await tx.collection('tryon_tasks').doc(taskId).get();
    if (fresh.data && fresh.data.status === 'success') {
      await tx.commit();
      return { ok: true, idempotent: true };
    }
    await tx.collection('tryon_tasks').doc(taskId).update({
      data: { status: 'success', updated_at: db.serverDate() }
    });
    const resultDoc = {
      task_id: taskId,
      user_id: task.data.user_id || task.data._openid,
      avatar_view_id: task.data.avatar_view_id,
      garment_id: task.data.garment_id,
      tryon_image: tryonImage,
      tryon_video: tryonVideo,
      provider_task_id: providerTaskId || '',
      created_at: db.serverDate(),
      createdAt: db.serverDate(),
      updated_at: db.serverDate()
    };
    const exist = await tx.collection('tryon_results').where({ task_id: taskId }).get();
    if (exist.data.length > 0) {
      await tx.collection('tryon_results').doc(exist.data[0]._id).update({ data: resultDoc });
    } else {
      await tx.collection('tryon_results').add({ data: resultDoc });
    }
    await tx.commit();
    return { ok: true };
  } catch (e) {
    await tx.rollback();
    throw e;
  }
};

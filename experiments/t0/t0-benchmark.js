/* T0 Try-On Capability Benchmark
 * 在微信开发者工具中运行此脚本
 * 方法：打开开发者工具 → 控制台 → 粘贴执行，或通过 miniprogram-automator 连接
 */

const RESULT_DIR = "experiments/t0";

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/* 通用云函数调用包装 */
function callCloud(name, data) {
  return new Promise((resolve) => {
    wx.cloud.callFunction({ name, data,
      success: res => resolve({ ok: true, result: res.result }),
      fail: err => resolve({ ok: false, errMsg: (err && err.errMsg) || String(err) })
    });
  });
}

/* 查询数据库 */
function queryDB(collection, query) {
  return new Promise((resolve) => {
    wx.cloud.database().collection(collection)
      .where(query || {})
      .orderBy("createdAt", "desc")
      .limit(20)
      .get({
        success: res => resolve({ ok: true, data: res.data }),
        fail: err => resolve({ ok: false, errMsg: err.errMsg })
      });
  });
}

/* ===== 第一步：寻找真实实验资产 ===== */
async function discoverAssets() {
  console.log("\n==========  discovering real assets ==========");

  // 1. 查找真实 avatar views
  const avRes = await queryDB("avatar_views");
  console.log("\n[avatar_views] count:", avRes.ok ? avRes.data.length : avRes.errMsg);
  if (avRes.ok && avRes.data.length > 0) {
    avRes.data.forEach((d, i) => {
      console.log(`  [${i}] id=${d._id} status=${d.status} provider=${d.provider} composite=${(d.views && d.views.composite) || "none"}`);
    });
  }

  // 2. 查找真实 garments
  const gRes = await queryDB("garments", { status: "ready" });
  console.log("\n[garments] count:", gRes.ok ? gRes.data.length : gRes.errMsg);
  if (gRes.ok && gRes.data.length > 0) {
    gRes.data.forEach((d, i) => {
      console.log(`  [${i}] id=${d._id} name=${d.name} cat=${d.category} type=${d.type} fileID=${(d.original_file_id || "NONE").substring(0, 40)}`);
    });
  }

  // 3. 查找已有 Try-On 结果
  const tRes = await queryDB("tryon_tasks");
  console.log("\n[tryon_tasks] count:", tRes.ok ? tRes.data.length : tRes.errMsg);
  if (tRes.ok && gRes.data.length > 0) {
    tRes.data.slice(0, 5).forEach((d, i) => {
      console.log(`  [${i}] taskId=${d._id} status=${d.status} type=${d.type} image=${(d.tryon_image || "none").substring(0, 40)}`);
    });
  }

  return { avatarViews: avRes.ok ? avRes.data : [], garments: gRes.ok ? gRes.data : [], tryonTasks: tRes.ok ? tRes.data : [] };
}

/* ===== T0-A：Avatar + Garment（生产链路）===== */
async function runT0A(avatarViewId, garmentId, garmentName) {
  console.log("\n========== T0-A: Avatar + Garment ==========");
  const t0 = Date.now();

  const res = await callCloud("aiTryon", {
    action: "submit",
    avatarViewId: avatarViewId,
    garmentIds: [garmentId],
    garmentNames: [garmentName],
    mode: "image"
  });

  console.log("submit result:", JSON.stringify(res));
  if (!res.ok || !res.result || !res.result.taskId) {
    console.log("T0-A FAILED at submit");
    return null;
  }

  const taskId = res.result.taskId;
  console.log("taskId:", taskId);

  // Poll status
  for (let i = 0; i < 20; i++) {
    await sleep(2000);
    const st = await callCloud("aiTryon", { action: "status", taskId });
    console.log(`  poll[${i}] status=${st.result ? st.result.status : "unknown"} image=${st.result && st.result.tryonImage ? "yes" : "no"}`);
    if (st.result && (st.result.status === "success" || st.result.status === "failed")) {
      console.log("T0-A FINAL:", JSON.stringify(st.result));
      return {
        experimentId: "T0-A",
        avatarViewId,
        garmentId,
        garmentName,
        taskId,
        refCount: 2,
        refOrder: "[avatarComposite, garmentOriginal]",
        model: "agnes-image-2.1-flash",
        size: "1024x1024",
        resultUrl: st.result.tryonImageUrl || st.result.tryonImage || "",
        status: st.result.status,
        error: st.result.error || "",
        elapsedMs: Date.now() - t0
      };
    }
  }
  console.log("T0-A TIMEOUT after 40s");
  return { experimentId: "T0-A", avatarViewId, garmentId, garmentName, taskId, status: "timeout" };
}

/* ===== T0-B：Garment-only ===== */
async function runT0B(garmentOriginalUrl, garmentName) {
  console.log("\n========== T0-B: Garment-only ==========");
  const prompt = `请基于参考图生成一件衣物的照片级平铺展示图。要求：白色背景，正面拍摄，服装版型、颜色、图案、面料质地与参考图完全一致，画面干净无杂物。禁止：变形、串色、添加参考图中没有的元素。`;
  const t0 = Date.now();

  // 调用 aiTryon 但模拟单参考图场景：通过特殊参数触发
  // 注意：当前生产链路强制需要 avatarViewId，这里只能记录实验设计
  console.log("T0-B 需要绕过生产链路直接调用 Agnes API");
  console.log("设计参数：");
  console.log("  refImages:", `[${garmentOriginalUrl}]`);
  console.log("  prompt:", prompt.substring(0, 80) + "...");
  console.log("  model:", "agnes-image-2.1-flash");

  return {
    experimentId: "T0-B",
    garmentName,
    refCount: 1,
    refOrder: "[garmentOriginal]",
    prompt,
    status: "DESIGN_ONLY",
    note: "需要直接调用 Agnes API，当前生产链路不支持单参考图模式"
  };
}

/* ===== T0-C：Avatar-only ===== */
async function runT0C(avatarCompositeUrl) {
  console.log("\n========== T0-C: Avatar-only ==========");
  const prompt = `基于参考图的人物三视图，生成一张照片级全身正面照。要求：人物面部、五官、发型与参考图完全一致，不可改变人物身份；全身入镜，正面站姿，双手自然垂于身体两侧，穿着贴身浅色基础内衣；纯白色背景，均匀柔和三点布光，写实摄影风格。禁止：面部变形，肢体缺失，画面文字与水印。`;

  return {
    experimentId: "T0-C",
    refCount: 1,
    refOrder: "[avatarComposite]",
    prompt,
    status: "DESIGN_ONLY",
    note: "需要直接调用 Agnes API，当前生产链路不支持单参考图模式"
  };
}

/* ===== 主实验流程 ===== */
async function runBenchmark() {
  console.log("\n========================================");
  console.log(" T0 Try-On Capability Benchmark");
  console.log("========================================");

  // Step 1: Discover
  const assets = await discoverAssets();

  if (assets.avatarViews.length === 0) {
    console.log("\n⚠ 没有可用的 avatarView，请先在小程序中完成人物照片上传和 Avatar 生成");
    return;
  }
  if (assets.garments.length === 0) {
    console.log("\n⚠ 没有可用的 garment，请先上传至少 1 件真实衣物");
    return;
  }

  // Step 2: Select test data
  const avatarView = assets.avatarViews[0];
  const avatarComposite = (avatarView.views && avatarView.views.composite) || "";
  console.log("\n使用 avatarViewId:", avatarView._id);
  console.log("avatarComposite:", avatarComposite.substring(0, 60) + "...");

  // 选择 3 件不同类型的衣物
  const categories = ["上衣", "裤子", "其他"];
  const testGarments = [];
  for (const cat of categories) {
    const found = assets.garments.find(g => g.category === cat && g.type === "upload");
    if (found) testGarments.push(found);
  }
  // 如果不足 3 件，补充
  for (const g of assets.garments) {
    if (g.type === "upload" && !testGarments.includes(g)) {
      testGarments.push(g);
      if (testGarments.length >= 3) break;
    }
  }

  console.log("\n选择的测试衣物:", testGarments.map(g => `${g.name}(${g.category})`).join(", "));

  // Step 3: Run T0-A for each garment
  const results = [];
  for (const g of testGarments) {
    const r = await runT0A(avatarView._id, g._id, g.name);
    if (r) results.push(r);
    await sleep(1000); // 避免速率限制
  }

  // Step 4: Record
  const record = {
    benchmark: "T0",
    executedAt: new Date().toISOString(),
    environment: {
      cloudEnv: wx.cloud.DYNAMIC_CURRENT_ENV,
      appid: wx.getAppInfo ? wx.getAppInfo().appId : "unknown"
    },
    assets: {
      avatarViewId: avatarView._id,
      avatarComposite: avatarComposite,
      garments: testGarments.map(g => ({ id: g._id, name: g.name, category: g.category }))
    },
    experiments: results
  };

  console.log("\n========== BENCHMARK COMPLETE ==========");
  console.log(JSON.stringify(record, null, 2));
  return record;
}

// 自动执行
runBenchmark().catch(e => console.error("BENCHMARK FAIL:", e.message));
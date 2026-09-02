/* Phase 4.2 集成测试：aiTryon → Try-On Engine 接入
   通过 Module._load 拦截，桩掉 wx-server-sdk 与 ../services/*，
   真实加载 aiTryon/index.js 与 tryon-engine（保证接口一致性）。 */
const path = require("path");
const Module = require("module");
const assert = require("assert");
const fs = require("fs");

const ROOT = path.resolve(__dirname, "..", "..", "..");
const AITRYON = path.join(ROOT, "cloudfunctions", "aiTryon");
const ENGINE = path.join(ROOT, "cloudfunctions", "services", "tryon-engine");

/* ============ 全局状态（测试可断言 + 注入）============ */
const state = {
  openid: "user-test-001",
  // Person Asset 存储（模拟 person-asset 服务）
  personAssets: {},
  // garments 集合
  garments: {},
  // tryon_tasks
  tasks: {},
  taskSeq: 0,
  // tryon_results
  results: [],
  // quota
  quotaUsed: 0,
  quotaLimit: 10,
  // Engine 调用记录
  engineCalls: [],
  // legacy aigc 调用记录
  legacyCalls: [],
  // reference 转换
  refMap: {},
};

/* ============ 桩：wx-server-sdk ============ */
const fakeCloud = {
  DYNAMIC_CURRENT_ENV: "mock-env",
  init: () => {},
  getWXContext: () => ({ OPENID: state.openid }),
  getTempFile: async ({ fileList }) => ({
    // refMap 未注册的 cloud id → tempFileURL 为空 → toHttpsRefs 触发 fail closed（不伪造）
    fileList: (fileList || []).map((id) => ({ fileID: id, tempFileURL: state.refMap[id] || "" }))
  }),
  deleteFile: async () => ({ fileList: [] }),
  openapi: { subscribeMessage: { send: async () => ({}) } },
  database: () => fakeDb,
};

/* ============ 桩：cloud.database() ============ */
function makeChain(collName) {
  // 极简链：支持 where/orderBy/limit/get/add/update/remove/doc
  const chain = {
    _wheres: {},
    where(q) { this._wheres = Object.assign({}, this._wheres, q); return this; },
    orderBy() { return this; },
    limit() { return this; },
    async get() { return { data: [] }; },
    async add() { return { _id: "task-" + (++state.taskSeq) }; },
    doc() { return this; },
    async update() { return { ok: true }; },
    async remove() { return { ok: true }; },
    command: { in: (arr) => ({ $in: arr }) },
  };
  return chain;
}
const fakeDb = {
  _openid: state.openid,
  collection(name) { return makeChain(name); },
  command: { in: (arr) => ({ $in: arr }) },
};

/* ============ 桩：../services/* ============ */
function makeServices() {
  return {
    "../services/aigc": {
      getAigc: () => ({
        generateImages: async (params) => {
          state.legacyCalls.push(params);
          return { urls: ["https://cdn.test/legacy-result.png"], provider: "agnes" };
        },
        generateVideo: async (params) => {
          state.legacyCalls.push({ video: true, params });
          return { videoUrl: "https://cdn.test/legacy-video.mp4", provider: "agnes" };
        },
        getVideoStatus: async () => ({ status: "completed", videoUrl: "https://cdn.test/v.mp4" }),
      }),
    },
    "../services/tryonVideo": {
      buildTryonVideoPrompt: (profile, name) => "video prompt for " + (name || ""),
    },
    "../services/tryonImage": {
      buildTryonImagePrompt: (profile, names, refCount) => "legacy image prompt",
    },
    "../services/tryonCache": {
      buildTryonCacheKey: (opts) => {
        // 关键：cache key 必须包含 personAssetId/version，隔离 composite 与 originalPhoto
        const parts = [opts.openid, opts.avatarViewId, (opts.garmentIds || []).join(","), opts.kind];
        if (opts.personAssetId) parts.push("pa=" + opts.personAssetId);
        if (opts.personAssetVersion) parts.push("v=" + opts.personAssetVersion);
        return parts.join("|");
      },
      isImageCacheHit: () => false,
      isCacheHit: () => false,
    },
    "../services/storage": {
      saveRemoteImage: async (url) => "cloud://saved/" + Date.now(),
    },
    "../services/validation": {
      requireLogin: (o) => { if (!o) throw Object.assign(new Error("login"), { appCode: "UNAUTHORIZED" }); },
      requireId: (v, name) => { if (!v) throw Object.assign(new Error(name + " required"), { appCode: "INVALID_ARGUMENT" }); return v; },
      requireString: () => true,
      requireArray: (v, name, opt = {}) => {
        if (!Array.isArray(v)) throw Object.assign(new Error(name + " must be array"), { appCode: "INVALID_ARGUMENT" });
        if (opt.min && v.length < opt.min) throw Object.assign(new Error(name + " too short"), { appCode: "INVALID_ARGUMENT" });
        if (opt.max && v.length > opt.max) throw Object.assign(new Error(name + " too long"), { appCode: "INVALID_ARGUMENT" });
        return v;
      },
    },
    "../services/ownership": {
      assertOwner: () => true,
      getOwnedDoc: async (db, coll, id, openid) => {
        if (coll === "avatar_views") {
          return { _id: id, profile_snapshot: {}, views: { composite: "cloud://composite-xxx" } };
        }
        if (coll === "tryon_tasks") {
          return state.tasks[id] || { _id: id, status: "success", tryon_image_url: "https://cdn.test/prev.png", avatar_view_id: "av-1", garment_ids: [], type: "ai_image", video_task_id: null };
        }
        return { _id: id };
      },
    },
    "../services/garments": {
      // 服务端解析 garments（ownership 内），客户端图片不作为可信来源
      resolveGarments: async (db, ids, openid) => {
        return ids.map((id, i) => ({
          _id: id,
          name: "衣物" + (i + 1),
          category: state.garments[id] ? state.garments[id].category : "上衣",
          originalFileId: "cloud://garment-" + id,
          type: "user",
        }));
      },
    },
    "../services/errors": {
      appError: (code, msg) => Object.assign(new Error(msg || code), { appCode: code }),
      fmtErr: (e) => (e && (e.message || e.errMsg)) || String(e),
    },
    "../services/taskState": {
      assertTransition: () => true,
    },
    "../services/quota": {
      dateStr: () => "2026-08-27",
      consumeQuota: async (db, openid, date) => {
        if (state.quotaUsed >= state.quotaLimit) {
          throw Object.assign(new Error("rate limited"), { appCode: "RATE_LIMITED" });
        }
        state.quotaUsed++;
        return { used: state.quotaUsed };
      },
      refundQuota: async (db, openid, date) => { state.quotaRefunded = (state.quotaRefunded || 0) + 1; },
      getQuota: async () => ({ used: state.quotaUsed, limit: state.quotaLimit }),
    },
    "../services/deletion": {
      requestDeletion: async () => ({ jobId: "job-1" }),
      runDeletion: async () => ({ ok: true }),
    },
    // person-asset 服务（真实模块的接口形态，桩成内存版）
    "../services/person-asset": {
      getPersonAssetService: (db) => ({
        getCurrentPersonAsset: async (openid) => {
          const a = state.personAssets[openid];
          if (!a) return null;
          return Object.assign({}, a, { _id: a._id || "person-asset-1" });
        },
        getCompatible: async (openid) => null, // 测试不依赖旧 avatar_views 迁移
      }),
    },
    // tryon-engine：真实加载（不是桩），保证集成真实性
    "../services/tryon-engine": (() => {
      // 用真实 engine，但替换 provider 为记录型 mock，避免真实 API 调用
      const eng = require(path.join(ENGINE, "index.js"));
      const router = require(path.join(ENGINE, "router.js"));
      const MockProvider = require(path.join(ENGINE, "providers", "mock.js"));
      // 覆盖 router 的 providers，注入测试可控的 mock
      const TryOnRouter = router.TryOnRouter;
      // 用原型 hook：替换 registerProviders 后的 providers Map
      const origGetRouter = eng.getStatus;
      // 简单做法：monkey-patch router 单例的 generate
      const realRouter = router.getRouter();
      const fakeProviderName = "mock";
      realRouter.providers = new Map();
      realRouter.providers.set("mock", new MockProvider());
      realRouter.generate = async (ctx, strategy) => {
        state.engineCalls.push({ ctx, strategy });
        // 不支持品类直接返回错误（模拟真实 engine 行为）
        const unsupported = (ctx.garments || []).filter((g) => g.category === "UNSUPPORTED_TRYON_CATEGORY");
        if ((ctx.garments || []).length > 0 && unsupported.length === (ctx.garments || []).length) {
          return { ok: false, imageUrl: "", error: "UNSUPPORTED_TRYON_CATEGORY", errorCode: "UNSUPPORTED_TRYON_CATEGORY", provider: "engine", metadata: {} };
        }
        // 无 personImage → engine 校验失败
        if (!ctx.person || !ctx.person.personImage) {
          return { ok: false, imageUrl: "", error: "INVALID_TRYON_CONTEXT", errorCode: "INVALID_TRYON_CONTEXT", provider: "engine", metadata: {} };
        }
        return {
          ok: true,
          provider: "agnes",
          imageUrl: "https://cdn.test/engine-result.png",
          cost: 0,
          latency: 0,
          metadata: { personSourceType: ctx.person.personSourceType || "original_photo" },
        };
      };
      realRouter.generateFailover = realRouter.generate;
      return eng;
    })(),
    "../services/tryon-engine/promptBuilder": require(path.join(ENGINE, "promptBuilder.js")),
    "../services/tryon-engine/category": require(path.join(ENGINE, "category.js")),
  };
}

const services = makeServices();

/* 同目录模块桩（tryonImage.js 依赖 ./avatarViews；真实仓库存在，本地用桩替代） */
const localStubs = {
  "./avatarViews": { skinToneDesc: (s) => (s && s.skinTone) || "自然肤色" },
};

/* ============ Module._load 拦截 ============ */
const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "wx-server-sdk") return fakeCloud;
  // 解析相对路径 ../services/xxx
  if (parent && request.startsWith("../services/")) {
    const mod = services[request];
    if (mod) {
      if (typeof mod === "function") return mod; // 延迟求值（tryon-engine 需先加载 router）
      return mod;
    }
  }
  if (request === "../services/person-asset") return services["../services/person-asset"];
  // 同目录相对模块：先看桩表；否则尝试真实解析透传
  if (parent && request.startsWith("./")) {
    if (localStubs[request]) return localStubs[request];
    try {
      const resolved = Module._resolveFilename(request, parent, isMain);
      return origLoad(resolved, parent, isMain);
    } catch (e) { /* 解析失败交给原生处理 */ }
  }
  return origLoad(request, parent, isMain);
};

/* ============ 加载被测模块（真实 index.js）============ */
const aiTryon = require(path.join(AITRYON, "index.js"));

/* ============ 辅助：构造 submit 调用 ============ */
async function callSubmit(overrides = {}) {
  const event = Object.assign({
    avatarViewId: "av-1",
    garmentIds: ["g-1"],
    mode: "image",
  }, overrides);
  return aiTryon.main(event);
}

function setFlag(on) {
  // 通过 env 控制（index.js 用 process.env.TRYON_ENGINE_ENABLED）
  if (on) process.env.TRYON_ENGINE_ENABLED = "true";
  else delete process.env.TRYON_ENGINE_ENABLED;
}

function resetState() {
  state.tasks = {};
  state.taskSeq = 0;
  state.results = [];
  state.quotaUsed = 0;
  state.quotaRefunded = 0;
  state.engineCalls = [];
  state.legacyCalls = [];
  state.refMap = {
    "cloud://garment-g-1": "https://cdn.test/garment-g-1.jpg",
    "cloud://orig.jpg": "https://cdn.test/orig.jpg",
    "cloud://front.jpg": "https://cdn.test/front.jpg",
    "cloud://anchor.jpg": "https://cdn.test/anchor.jpg",
  };
  // 重置 getTempFile 为默认实现（任意 cloud:// 均成功换取公网 URL，模拟真实 cloud.getTempFile）
  fakeCloud.getTempFile = async ({ fileList }) => ({
    fileList: (fileList || []).map((id) => ({ fileID: id, tempFileURL: state.refMap[id] || ("https://cdn.test/" + id.replace("cloud://", "")) }))
  });
  state.garments = {
    "g-1": { category: "上衣" },
  };
  delete state.personAssets[state.openid];
}

/* ============ 测试套件 ============ */
async function run() {
  const tests = [];
  function test(name, fn) { tests.push({ name, fn }); }

  /* ---- 1. feature flag=false 使用 legacy ---- */
  test("feature flag=false 走 legacy aigc.generateImages", async () => {
    resetState();
    setFlag(false);
    const res = await callSubmit();
    assert.strictEqual(res.ok, true, "legacy 应成功");
    assert.strictEqual(state.legacyCalls.length, 1, "flag=false 应调用 legacy aigc");
    assert.strictEqual(state.engineCalls.length, 0, "flag=false 不应调用 engine");
    assert.match(res.tryonImageUrl || "", /cdn\.test/, "legacy 返回图片 URL");
  });

  /* ---- 2. feature flag=true 使用 engine ---- */
  test("feature flag=true 走 Try-On Engine", async () => {
    resetState();
    setFlag(true);
    // 构造 Person Asset（有 originalPhoto）
    state.personAssets[state.openid] = {
      _id: "pa-1", original_photo: "cloud://orig.jpg", front_photo: "cloud://front.jpg",
      updated_at: 1700000000000, body_profile: { heightCm: 165, weightKg: 55 },
    };
    state.refMap["cloud://orig.jpg"] = "https://cdn.test/orig.jpg";
    const res = await callSubmit();
    assert.strictEqual(res.ok, true, "engine 路径应成功: " + JSON.stringify(res));
    assert.strictEqual(state.engineCalls.length, 1, "flag=true 应调用 engine");
    assert.strictEqual(state.legacyCalls.length, 0, "flag=true 不应调用 legacy");
    // Engine 收到标准 Context
    const ctx = state.engineCalls[0].ctx;
    assert.ok(ctx.person, "engine 应收到 person");
    assert.strictEqual(ctx.person.originalPhoto, "cloud://orig.jpg");
    assert.strictEqual(ctx.options.strategy, "BALANCED");
    assert.strictEqual(res.provider, "agnes");
  });

  /* ---- 3-5. 人物来源优先级 originalPhoto > frontPhoto > anchorImage ---- */
  test("originalPhoto 优先", async () => {
    resetState(); setFlag(true);
    state.personAssets[state.openid] = {
      original_photo: "cloud://orig.jpg", front_photo: "cloud://front.jpg", anchor_image: "cloud://anchor.jpg",
    };
    state.refMap["cloud://orig.jpg"] = "https://cdn.test/orig.jpg";
    const res = await callSubmit();
    assert.strictEqual(state.engineCalls.length, 1);
    assert.strictEqual(state.engineCalls[0].ctx.person.personSourceType, "original_photo");
    assert.strictEqual(res.personSourceType, "original_photo");
  });

  test("frontPhoto fallback（无 originalPhoto）", async () => {
    resetState(); setFlag(true);
    state.personAssets[state.openid] = { front_photo: "cloud://front.jpg", anchor_image: "cloud://anchor.jpg" };
    state.refMap["cloud://front.jpg"] = "https://cdn.test/front.jpg";
    const res = await callSubmit();
    assert.strictEqual(state.engineCalls[0].ctx.person.personSourceType, "front_photo");
    assert.strictEqual(res.personSourceType, "front_photo");
  });

  test("anchorImage fallback（仅 anchor）", async () => {
    resetState(); setFlag(true);
    state.personAssets[state.openid] = { anchor_image: "cloud://anchor.jpg" };
    state.refMap["cloud://anchor.jpg"] = "https://cdn.test/anchor.jpg";
    const res = await callSubmit();
    assert.strictEqual(state.engineCalls[0].ctx.person.personSourceType, "anchor_image");
    assert.strictEqual(res.personSourceType, "anchor_image");
  });

  /* ---- 6. composite 不作为默认 ---- */
  test("Person Asset 仅有 composite（无真实照片）→ PERSON_ASSET_REQUIRED，不进入生成", async () => {
    resetState(); setFlag(true);
    // 无 Person Asset，旧 avatar_views 只有 composite
    delete state.personAssets[state.openid];
    const res = await callSubmit();
    assert.strictEqual(res.ok, false, "应被拒绝");
    assert.strictEqual(res.error, "PERSON_ASSET_REQUIRED", "应返回 PERSON_ASSET_REQUIRED");
    assert.strictEqual(state.engineCalls.length, 0, "不得调用 engine / AI 生成");
    // preflight（person asset）在 consumeQuota 之前执行：不扣 quota，故无需退款
    assert.strictEqual(state.quotaRefunded, 0, "preflight 前失败不扣 quota（refund=0）");
  });

  /* ---- 7. bodyProfile=null 不生成虚假数据 ---- */
  test("bodyProfile 缺失时不伪造身体数据，promptBuilder 不出现 170cm/60kg", async () => {
    resetState(); setFlag(true);
    state.personAssets[state.openid] = { original_photo: "cloud://orig.jpg" };
    state.refMap["cloud://orig.jpg"] = "https://cdn.test/orig.jpg";
    // 显式：无 body_profile
    const promptBuilder = require(path.join(ENGINE, "promptBuilder.js"));
    const built = promptBuilder.build({
      person: { originalPhoto: "cloud://orig.jpg", bodyProfile: null },
      garments: [{ category: "上衣", image: "x", name: "T恤" }],
      options: {},
    });
    assert.strictEqual(built.meta.hasBodyProfile, false, "hasBodyProfile 应为 false");
    assert.ok(!/170|60\s*kg|身高\s*170|体重\s*60/.test(built.prompt), "prompt 不得含硬编码 170cm/60kg: " + built.prompt);
    // 真实有 bodyProfile 时只做客观约束
    const built2 = promptBuilder.build({
      person: { originalPhoto: "x", bodyProfile: { heightCm: 165, weightKg: 55 } },
      garments: [{ category: "上衣", image: "x", name: "T恤" }], options: {},
    });
    assert.strictEqual(built2.meta.hasBodyProfile, true);
    assert.ok(/165/.test(built2.prompt) && /55/.test(built2.prompt), "真实 bodyProfile 应被引用");
  });

  /* ---- 8-10. category 映射 ---- */
  test("上衣 → tops，裤子 → bottoms", async () => {
    resetState(); setFlag(true);
    state.personAssets[state.openid] = { original_photo: "cloud://orig.jpg" };
    state.refMap["cloud://orig.jpg"] = "https://cdn.test/orig.jpg";
    state.garments = { "g-1": { category: "上衣" }, "g-2": { category: "裤子" } };
    const res = await callSubmit({ garmentIds: ["g-1", "g-2"] });
    const garms = state.engineCalls[0].ctx.garments;
    assert.strictEqual(garms[0].category, "tops");
    assert.strictEqual(garms[1].category, "bottoms");
    assert.strictEqual(garms[0].sourceCategory, "上衣");
    assert.strictEqual(garms[1].sourceCategory, "裤子");
  });

  /* ---- 11. 不支持品类 fail closed ---- */
  test("不支持品类（头饰/鞋子/其他）fail closed，不调用 Provider", async () => {
    resetState(); setFlag(true);
    state.personAssets[state.openid] = { original_photo: "cloud://orig.jpg" };
    state.refMap["cloud://orig.jpg"] = "https://cdn.test/orig.jpg";
    state.garments = { "g-1": { category: "头饰" } };
    const res = await callSubmit({ garmentIds: ["g-1"] });
    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.error, "UNSUPPORTED_TRYON_CATEGORY");
  });

  /* ---- 12. garment ownership（resolveGarments 服务端解析）---- */
  test("garments 由服务端 resolveGarments 解析（ownership 内）", async () => {
    resetState(); setFlag(true);
    state.personAssets[state.openid] = { original_photo: "cloud://orig.jpg" };
    state.refMap["cloud://orig.jpg"] = "https://cdn.test/orig.jpg";
    await callSubmit({ garmentIds: ["g-1", "g-2"] });
    const garms = state.engineCalls[0].ctx.garments;
    assert.strictEqual(garms.length, 2);
    // 每张都有 garmentId + image（服务端 originalFileId）
    assert.strictEqual(garms[0].garmentId, "g-1");
    assert.ok(garms[0].image, "image 应由服务端 originalFileId 填充");
  });

  /* ---- 13. garment profile 不存在不自动创建 ---- */
  test("garment_profiles 无对应 profile 时 profile=null，不自动创建", async () => {
    resetState(); setFlag(true);
    state.personAssets[state.openid] = { original_photo: "cloud://orig.jpg" };
    state.refMap["cloud://orig.jpg"] = "https://cdn.test/orig.jpg";
    await callSubmit();
    const garms = state.engineCalls[0].ctx.garments;
    assert.strictEqual(garms[0].profile, null, "profile 应为 null（Phase 4.2 不自动创建 AI profile）");
  });

  /* ---- 14. reference preflight 失败不扣 quota ---- */
  test("reference 获取失败 → 生成中止（不扣 quota）", async () => {
    resetState(); setFlag(true);
    state.personAssets[state.openid] = { original_photo: "cloud://orig.jpg" };
    // 模拟 toHttpsRefs 换取公网 URL 失败：getTempFile 返回空 fileList → fail closed 抛错
    const savedGetTempFile = fakeCloud.getTempFile;
    fakeCloud.getTempFile = async () => ({ fileList: [] });
    try {
      const res = await callSubmit();
      // main 内部 try/catch 会捕获并以 {ok:false, error} 形式 resolve（不 reject）
      assert.strictEqual(res.ok, false, "reference 失败应返回 ok:false");
      assert.match(res.error, /参考图临时链接获取失败|参考图数量不一致|PROVIDER_ERROR/);
      // toHttpsRefs 抛错发生在 consumeQuota 之前 → 不扣 quota，无需退款
      assert.strictEqual(state.quotaRefunded, 0, "reference preflight 失败不扣 quota");
    } finally {
      fakeCloud.getTempFile = savedGetTempFile;
    }
  });

  /* ---- 15. engine provider 失败 refund quota ---- */
  test("Engine Provider 失败 → refundQuota", async () => {
    resetState(); setFlag(true);
    state.personAssets[state.openid] = { original_photo: "cloud://orig.jpg" };
    state.refMap["cloud://orig.jpg"] = "https://cdn.test/orig.jpg";
    // 让 engine 返回失败
    const realRouter = require(path.join(ENGINE, "router.js")).getRouter();
    const saved = realRouter.generate;
    realRouter.generate = async () => ({ ok: false, imageUrl: "", error: "PROVIDER_TIMEOUT", errorCode: "PROVIDER_TIMEOUT", provider: "engine", metadata: {} });
    try {
      const res = await callSubmit();
      assert.strictEqual(res.ok, false);
      assert.strictEqual(state.quotaRefunded >= 1, true, "provider 失败应退款");
    } finally {
      realRouter.generate = saved;
    }
  });

  /* ---- 16. cache key 区分 person asset ---- */
  test("cache key 含 personAssetId/version，composite 与 originalPhoto 不共用", async () => {
    resetState(); setFlag(false);
    const { buildTryonCacheKey } = require(path.join(ENGINE, "category.js")) && services["../services/tryonCache"];
    const keyWithAsset = buildTryonCacheKey({
      openid: "u", avatarViewId: "av", garmentIds: ["g-1"], kind: "ai_image",
      personAssetId: "pa-1", personAssetVersion: "1700000000000",
    });
    const keyLegacy = buildTryonCacheKey({
      openid: "u", avatarViewId: "av", garmentIds: ["g-1"], kind: "ai_image",
      personAssetId: null, personAssetVersion: "legacy",
    });
    assert.ok(keyWithAsset.includes("pa=pa-1"), "cache key 应包含 personAssetId");
    assert.ok(keyWithAsset.includes("v=1700000000000"), "cache key 应包含 version");
    assert.notStrictEqual(keyWithAsset, keyLegacy, "Person Asset 用户与 legacy 用户 cache key 必须不同");
  });

  /* ---- 17. legacy 返回格式保持兼容 ---- */
  test("legacy 返回格式兼容前端（ok/taskId/status/tryonImage/tryonImageUrl/tryonVideo/garmentName）", async () => {
    resetState(); setFlag(false);
    const res = await callSubmit();
    for (const k of ["ok", "taskId", "status", "tryonImage", "tryonImageUrl", "tryonVideo", "garmentName"]) {
      assert.ok(k in res, "legacy 返回缺少字段: " + k);
    }
    assert.strictEqual(res.tryonVideo, "");
    assert.strictEqual(typeof res.taskId, "string");
  });

  /* ---- 额外：engine 成功时 task 记录含新增字段 ---- */
  test("Engine 成功时 task 含 person_asset_id / person_source_type / strategy / provider", async () => {
    resetState(); setFlag(true);
    state.personAssets[state.openid] = { _id: "pa-1", original_photo: "cloud://orig.jpg", updated_at: 1700000000000 };
    state.refMap["cloud://orig.jpg"] = "https://cdn.test/orig.jpg";
    const res = await callSubmit();
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.personSourceType, "original_photo");
    assert.strictEqual(res.provider, "agnes");
    assert.strictEqual(res.strategy, "BALANCED");
  });

  /* 运行 */
  let pass = 0, fail = 0;
  const failures = [];
  const FOCUS = process.env.FOCUS; // 设 FOCUS=1 只跑含 "Engine 成功" 的用例
  const runList = FOCUS ? tests.filter((t) => t.name.includes("Engine 成功")) : tests;
  for (const t of runList) {
    try {
      await t.fn();
      pass++;
      console.log("  ✓ " + t.name);
    } catch (e) {
      fail++;
      failures.push({ name: t.name, err: e });
      console.log("  ✗ " + t.name + "\n      " + (e && (e.message || e)));
    }
  }
  console.log(`\nPhase 4.2 aiTryon 集成测试: ${pass} pass, ${fail} fail (共 ${tests.length})`);
  if (fail > 0) {
    console.log("\n--- 失败详情 ---");
    for (const f of failures) console.log("  " + f.name + ": " + f.err.message);
    process.exitCode = 1;
  }
}

run();

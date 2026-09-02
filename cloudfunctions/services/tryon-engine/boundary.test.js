const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert");
const path = require("path");

// 直接加载真实模块（与 engine.test.js 一致，无 sinon 依赖）
const ctx = require("./context.js");
const { normalizeContext, validateContext } = ctx;
const router = require("./router.js");
const category = require("./category.js");
const { isSupportedForTryOn } = category;

/**
 * 构造一个「已规范化」的标准 Context。
 * 注意：normalizeContext 本身不抛错，只做规范化；校验由 validateContext 单独负责。
 * 所以测试「多/0 件 garment」要走 validateContext(normalizeContext(...))。
 */
function baseContext(overrides = {}) {
  const personDefaults = { originalPhoto: "A", frontPhoto: "B", anchorImage: "C", bodyProfile: null };
  const garmentsDefault = [
    { garmentId: "g1", image: "http://g/1", category: "tops", sourceCategory: "上衣", name: "T恤", profile: null },
  ];
  return normalizeContext({
    person: { ...personDefaults, ...(overrides.person || {}) },
    garments: overrides.garments !== undefined ? overrides.garments : garmentsDefault,
    strategy: overrides.strategy || "BALANCED",
    taskId: "task-001",
    ...(overrides.extra || {}),
  });
}

// 替换 router 单例的 providers Map 为可控 fake；返回还原函数。
// 关键：Router(BALANCED) 的候选列表是 [ALIYUN_TRYON, AGNES]，只从 Map 里按这些名字取。
// 所以 fake 必须用候选名（默认 "agnes"）才能被 Router 选中。
function installFakeProviders(fakes) {
  const r = router.getRouter();
  const orig = r.providers; // 原始 Map（备份）
  r.providers = new Map(orig); // 复制一份，保留结构
  for (const f of fakes) {
    const name = f.name || "agnes";
    r.providers.set(name, f); // 覆盖对应候选键
  }
  return () => {
    r.providers = orig; // 还原
  };
}

describe("Phase 4.3-A Boundary — normalizeContext 人物优先级", () => {
  it("originalPhoto 优先 → personImage = A", () => {
    const c = baseContext({ person: { originalPhoto: "A" } }); // A 优先
    assert.equal(c.person.personImage, "A");
    assert.equal(c.person.personSourceType, "original_photo");
  });

  it("无 originalPhoto 时选择 frontPhoto → B", () => {
    const c = baseContext({ person: { originalPhoto: null, frontPhoto: "B", anchorImage: "C" } });
    assert.equal(c.person.personImage, "B");
    assert.equal(c.person.personSourceType, "front_photo");
  });

  it("只有 anchorImage 时 → C", () => {
    const c = baseContext({ person: { originalPhoto: null, frontPhoto: null, anchorImage: "C" } });
    assert.equal(c.person.personImage, "C");
    assert.equal(c.person.personSourceType, "anchor_image");
  });

  it("三者皆无 → personImage 为 null（上层校验产生 PERSON_ASSET_REQUIRED）", () => {
    const c = baseContext({ person: { originalPhoto: null, frontPhoto: null, anchorImage: null } });
    assert.equal(c.person.personImage, null);
    // 上层校验行为：personImage 缺失 → invalid
    const v = validateContext(c);
    assert.equal(v.valid, false);
  });
});

describe("Phase 4.3-A Boundary — Router 不重新解释 Context", () => {
  let restore;
  afterEach(() => {
    if (restore) {
      restore();
      restore = null;
    }
  });

  it("Router 把标准 Context 原样传给 Provider，不覆盖 personImage", async () => {
    const captured = {};
    const fakeProvider = {
      name: "agnes",
      isConfigured: () => true,
      generate: async (c) => {
        captured.ctx = c;
        return { ok: true, provider: "capture", imageUrl: "http://x", cost: 0, metadata: {} };
      },
    };
    restore = installFakeProviders([fakeProvider]);

    const c = baseContext({ person: { originalPhoto: "A", frontPhoto: "B", anchorImage: "C" } });
    assert.equal(c.person.personImage, "A");

    const result = await router.getRouter().generate(c, "BALANCED");
    assert.ok(captured.ctx, "Provider 应被调用并捕获 ctx");
    assert.equal(captured.ctx.person.personImage, "A", "Router 不得把 personImage 改成其它来源");
    assert.equal(result.ok, true);
  });

  it("Router 不再从 originalPhoto 重新选图（frontPhoto 场景）", async () => {
    const captured = {};
    const fakeProvider = {
      name: "agnes",
      isConfigured: () => true,
      generate: async (c) => {
        captured.ctx = c;
        return { ok: true, provider: "capture2", imageUrl: "http://x", cost: 0, metadata: {} };
      },
    };
    restore = installFakeProviders([fakeProvider]);

    const c = baseContext({ person: { originalPhoto: null, frontPhoto: "B", anchorImage: "C" } });
    await router.getRouter().generate(c, "BALANCED");
    assert.equal(captured.ctx.person.personImage, "B");
    assert.notEqual(captured.ctx.person.personImage, "A");
  });

  it("Provider 收到的是标准 Context（含 garments[0]）", async () => {
    const captured = {};
    const fakeProvider = {
      name: "agnes",
      isConfigured: () => true,
      generate: async (c) => {
        captured.ctx = c;
        return { ok: true, provider: "capture3", imageUrl: "http://x", cost: 0, metadata: {} };
      },
    };
    restore = installFakeProviders([fakeProvider]);

    const garments = [
      { garmentId: "g1", image: "http://g/1", category: "tops", sourceCategory: "上衣", name: "T", profile: null },
    ];
    const c = baseContext({ garments });
    await router.getRouter().generate(c, "BALANCED");
    assert.equal(captured.ctx.garments.length, 1);
    assert.equal(captured.ctx.garments[0].category, "tops");
  });
});

describe("Phase 4.3-A Boundary — 单次 Image MVP 只支持 1 件 garment", () => {
  it("0 件 garment → validateContext 明确拒绝（errorCode = MULTI_GARMENT_NOT_SUPPORTED）", () => {
    const c = baseContext({ garments: [] });
    const v = validateContext(c);
    assert.equal(v.valid, false);
    // P1 修正：通过顶层 errorCode 精确断言（errors 仍为字符串数组，向后兼容）
    assert.equal(v.errorCode, 'MULTI_GARMENT_NOT_SUPPORTED');
  });

  it("多件 garment → validateContext 明确拒绝（不偷偷用第一个）", () => {
    const garments = [
      { garmentId: "g1", image: "http://g/1", category: "tops", sourceCategory: "上衣", name: "T", profile: null },
      { garmentId: "g2", image: "http://g/2", category: "bottoms", sourceCategory: "裤子", name: "裤子", profile: null },
    ];
    const c = baseContext({ garments });
    const v = validateContext(c);
    assert.equal(v.valid, false);
    assert.equal(v.errorCode, 'MULTI_GARMENT_NOT_SUPPORTED',
      `多 garment 必须返回 MULTI_GARMENT_NOT_SUPPORTED，实际：${v.errorCode}`);
    // errors 为 [{code,message}]，提取 message 拼接后校验提示文案
    const messages = (v.errors || []).map((e) => (e && e.message) || '').join(' ');
    assert.ok(/一件/.test(messages), `应提示仅支持一件，实际：${messages}`);
  });

  it("恰好 1 件 → 校验通过", () => {
    const c = baseContext();
    const v = validateContext(c);
    assert.equal(v.valid, true);
  });
});

describe("Phase 4.3-A Boundary — 品类支持范围", () => {
  it("tops 可进入验证", () => {
    assert.equal(isSupportedForTryOn("tops"), true);
  });

  it("bottoms 当前可进入（Aliyun 在 provider 层按 capability 处理）", () => {
    assert.equal(isSupportedForTryOn("bottoms"), true);
  });

  it("dress 当前必须 unsupported（不进入生产生成链）", () => {
    assert.equal(isSupportedForTryOn("dress"), false);
  });

  it("头饰 / 鞋子 / 其他 → unsupported", () => {
    assert.equal(isSupportedForTryOn("UNSUPPORTED_TRYON_CATEGORY"), false);
    assert.equal(isSupportedForTryOn("unknown"), false);
  });

  it("中文业务枚举经 toTryOnCategory 后鞋子/其他 → unsupported", () => {
    const { toTryOnCategory, ERROR_UNSUPPORTED } = category;
    assert.equal(toTryOnCategory("鞋子"), ERROR_UNSUPPORTED);
    assert.equal(toTryOnCategory("其他"), ERROR_UNSUPPORTED);
    assert.equal(toTryOnCategory("头饰"), ERROR_UNSUPPORTED);
  });
});

describe("Phase 4.3-A Boundary — Mock 不作为生产兜底", () => {
  let restore;
  afterEach(() => {
    if (restore) {
      restore();
      restore = null;
    }
  });

  it("无真实可用 Provider 时不能 Mock 伪成功 → 返回明确失败", async () => {
    restore = installFakeProviders([]); // 空候选列表
    const c = baseContext();
    const result = await router.getRouter().generate(c, "BALANCED");
    assert.equal(result.ok, false, `必须明确失败，不得伪成功：${JSON.stringify(result)}`);
    assert.ok(/provider/i.test(result.error || result.errorCode || ""));
  });

  it("显式测试 Mock Provider 仍然可以成功", async () => {
    // 直接取 Router 已注册的 mock provider，绕过候选选择，验证 mock 自身可工作
    const r = router.getRouter();
    const mockProvider = r.providers.get("mock");
    assert.ok(mockProvider, "Router 应已注册 mock provider");
    const c = baseContext();
    const result = await mockProvider.generate(c);
    assert.equal(result.ok, true);
    assert.equal(result.provider, "mock");
  });
});

describe("Phase 4.3-A Boundary — bodyProfile 不伪造", () => {
  it("无 bodyProfile 时不能出现默认身体参数", () => {
    const c = baseContext({ person: { originalPhoto: "A", bodyProfile: null } });
    assert.equal(c.person.bodyProfile, null);
  });

  it("不允许 170/60 等伪造默认值写入", () => {
    const c = baseContext({ person: { originalPhoto: "A", bodyProfile: null } });
    const bp = c.person.bodyProfile;
    if (bp) {
      assert.notEqual(bp.heightCm, 170);
      assert.notEqual(bp.weightKg, 60);
    }
  });
});

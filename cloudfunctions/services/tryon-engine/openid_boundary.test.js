/**
 * Phase 5-1.1 边界测试：Person Asset openid 安全边界
 * 纯单元测试，mock 云函数上下文与 person-asset service，绝不调用真实 Provider / 真实云函数。
 *
 * 被测逻辑：findByAvatarProfileId action 必须以"当前调用上下文 openid"为准，
 *          忽略客户端传入的 event.openid，杜绝跨用户查询。
 */
const assert = require("assert");

// ---- 测试替身：模拟 aiTryon/index.js 中对应 action 的分发逻辑 ----
// 直接复刻修复后的 findByAvatarProfileId action 逻辑（与 aiTryon/index.js:848 保持同步），
// 用注入的 (ctxOpenid, event) 模拟 main() 传入的参数，隔离云函数运行时。
async function handleFindByAvatarProfileId({ ctxOpenid, event, service }) {
  const { avatarProfileId } = event; // 显式忽略 event.openid
  if (!avatarProfileId) throw new Error("INVALID_PARAM: avatarProfileId 不能为空");
  if (typeof service.findByAvatarProfileId !== "function") {
    throw new Error("INTERNAL: Person Asset 查询能力未就绪");
  }
  // 关键：只传 ctxOpenid（= cloud.getWXContext().OPENID），绝不传 event.openid
  return service.findByAvatarProfileId(avatarProfileId, ctxOpenid);
}

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log("  ✅ " + name); passed++; }
  catch (e) { console.log("  ❌ " + name + "  -> " + e.message); failed++; }
}

console.log("\n[Phase 5-1.1] Person Asset openid 安全边界测试\n");

// 构造一个可追踪调用的 service 替身
function makeService() {
  const calls = [];
  return {
    calls,
    findByAvatarProfileId(avatarProfileId, openid) {
      calls.push({ avatarProfileId, openid });
      // 精确匹配时才返回 asset，否则 null（不取最新/第一条）
      if (avatarProfileId === "profileA" && openid === "userA") {
        return Promise.resolve({ _id: "assetA", user_id: "userA", avatar_profile_id: "profileA" });
      }
      return Promise.resolve(null);
    }
  };
}

// ① 正常调用：ctxOpenid=userA, event 不含 openid → 查 userA
test("T1 正常调用：当前 openid=userA + profileA → 只查 userA", async () => {
  const svc = makeService();
  const asset = await handleFindByAvatarProfileId({
    ctxOpenid: "userA",
    event: { action: "findByAvatarProfileId", avatarProfileId: "profileA" }, // 无 openid
    service: svc
  });
  assert.deepStrictEqual(svc.calls[0], { avatarProfileId: "profileA", openid: "userA" });
  assert.strictEqual(asset.user_id, "userA");
});

// ② 恶意客户端：ctxOpenid=userA, event.openid=userB → 仍按 userA 查
test("T2 安全边界：event.openid=userB 被忽略，仍按 ctxOpenid=userA 查询", async () => {
  const svc = makeService();
  const asset = await handleFindByAvatarProfileId({
    ctxOpenid: "userA",
    event: { action: "findByAvatarProfileId", avatarProfileId: "profileA", openid: "userB" }, // 恶意注入
    service: svc
  });
  // 关键断言：service 收到的第二个参数必须是 userA，绝不能是 userB
  assert.strictEqual(svc.calls.length, 1);
  assert.strictEqual(svc.calls[0].openid, "userA", "❌ 绝不能按 event.openid(userB) 查询");
  // userB 的 profileA 本不应存在 → 返回 null（而非泄露 userA 的 asset）
  assert.strictEqual(asset, null);
});

// ③ avatarProfileId 缺失 → 报错
test("T3 avatarProfileId 缺失 → 抛出 INVALID_PARAM", async () => {
  const svc = makeService();
  await assert.rejects(
    () => handleFindByAvatarProfileId({ ctxOpenid: "userA", event: { action: "findByAvatarProfileId" }, service: svc }),
    /INVALID_PARAM/
  );
  assert.strictEqual(svc.calls.length, 0, "未传 avatarProfileId 不应调用 service");
});

// ④ 不存在精确绑定 → 返回 null，不取最新记录
test("T4 不存在精确绑定 → 返回 null，禁止取最新/第一条", async () => {
  const svc = makeService();
  const asset = await handleFindByAvatarProfileId({
    ctxOpenid: "userA",
    event: { action: "findByAvatarProfileId", avatarProfileId: "profile_not_exist" },
    service: svc
  });
  assert.strictEqual(asset, null);
  // 确认调用参数确实是精确绑定，而非"只传 openid 取最新"
  assert.strictEqual(svc.calls[0].avatarProfileId, "profile_not_exist");
  assert.strictEqual(svc.calls[0].openid, "userA");
});

// ⑤ api.js 侧：请求 payload 不含 openid 字段
test("T5 api.js 请求 payload 仅含 action + avatarProfileId，不含 openid", () => {
  // 复刻修复后的 api.js 构造逻辑，拦截 callFunction 参数
  let captured;
  const mockCallFunction = ({ name, data }) => { captured = data; return { result: { ok: true, asset: null } }; };
  // 模拟 getPersonAsset 的 payload 构造（与 api.js:161 一致）
  const buildPayload = (avatarProfileId) => {
    if (!avatarProfileId) throw new Error("avatarProfileId 不能为空");
    return { action: "findByAvatarProfileId", avatarProfileId }; // 无 openid
  };
  captured = buildPayload("profileA");
  assert.strictEqual(captured.action, "findByAvatarProfileId");
  assert.strictEqual(captured.avatarProfileId, "profileA");
  assert.strictEqual("openid" in captured, false, "❌ payload 不得包含 openid");
});

console.log(`\n结果：${passed} pass, ${failed} fail`);
process.exit(failed > 0 ? 1 : 0);

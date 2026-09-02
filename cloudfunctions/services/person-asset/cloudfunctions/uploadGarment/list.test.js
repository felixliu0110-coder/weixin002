const test = require("node:test");
const assert = require("node:assert");
const Module = require("node:module");

function loadMain(rows) {
  let capturedWhere = null;
  const fakeCloud = {
    DYNAMIC_CURRENT_ENV: "test-env",
    init() {},
    getWXContext() {
      return { OPENID: "u1" };
    },
    database() {
      return {
        collection() {
          return {
            where(q) {
              capturedWhere = q;
              return {
                orderBy(field, dir) {
                  return {
                    limit(n) {
                      return {
                        async get() {
                          const data = rows
                            .filter(
                              (r) =>
                                r.user_id === q.user_id &&
                                r.type === q.type &&
                                r.status === q.status
                            )
                            .sort((a, b) => (b[field] || 0) - (a[field] || 0))
                            .slice(0, n);
                          return { data };
                        }
                      };
                    }
                  };
                }
              };
            }
          };
        }
      };
    }
  };
  const orig = Module._load;
  Module._load = function (request, parent, isMain) {
    if (request === "wx-server-sdk") return fakeCloud;
    return orig.apply(this, arguments);
  };
  try {
    delete require.cache[require.resolve("./index.js")];
    return { main: require("./index.js").main, getCapturedWhere: () => capturedWhere };
  } finally {
    Module._load = orig;
  }
}

test("uploadGarment list 只返回当前用户 upload+ready 衣物并映射字段", async () => {
  const rows = [
    { _id: "g1", user_id: "u1", type: "upload", status: "ready", name: "白色T恤", category: "上衣", original_file_id: "cloud://x/1.png", created_at: 3 },
    { _id: "g2", user_id: "u1", type: "upload", status: "failed", name: "失败件", category: "上衣", original_file_id: "cloud://x/2.png", created_at: 2 },
    { _id: "g3", user_id: "u2", type: "upload", status: "ready", name: "别人的", category: "上衣", original_file_id: "cloud://x/3.png", created_at: 1 }
  ];
  const { main, getCapturedWhere } = loadMain(rows);
  const res = await main({ action: "list" });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.list.length, 1);
  assert.strictEqual(res.list[0].id, "g1");
  assert.strictEqual(res.list[0].image, "cloud://x/1.png");
  assert.strictEqual(res.list[0].name, "白色T恤");
  assert.strictEqual(res.list[0].category, "上衣");
  assert.strictEqual(res.list[0].size_label, undefined);
  assert.strictEqual(res.list[0].measurements, undefined);
  assert.deepStrictEqual(getCapturedWhere(), { user_id: "u1", type: "upload", status: "ready" });
});

test("uploadGarment list 无匹配时返回空列表", async () => {
  const { main } = loadMain([]);
  const res = await main({ action: "list" });
  assert.strictEqual(res.ok, true);
  assert.deepStrictEqual(res.list, []);
});

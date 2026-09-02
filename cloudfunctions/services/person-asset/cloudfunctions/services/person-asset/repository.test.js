const { test } = require("node:test");
const assert = require("node:assert");
const Repository = require("/data/workspace/wt/cloudfunctions/services/person-asset/repository.js");

function makeDB(rows) {
  // rows: [{_id, avatar_profile_id, user_id, updated_at, ...photos}]
  return {
    collection: () => ({
      where: (w) => ({
        orderBy: () => ({
          limit: () => ({
            get: async () => ({ data: rows.filter((r) => {
              return Object.keys(w).every((k) => {
                if (k === "user_id") return r.user_id === w[k];
                if (k === "avatar_profile_id") return r.avatar_profile_id === w[k];
                return r[k] === w[k];
              });
            }).sort((a, b) => (b.updated_at || 0) - (a.updated_at || 0)) }),
          }),
        }),
      }),
    }),
  };
}

const photo = { original_photo: "u", front_photo: "f", anchor_image: "a" };

test("findByAvatarProfileId: 精确匹配 avatar_profile_id + openid", async () => {
  const db = makeDB([{ _id: "1", avatar_profile_id: "P", user_id: "u1", updated_at: 1, ...photo }]);
  const r = new Repository(db);
  const a = await r.findByAvatarProfileId("P", "u1");
  assert.equal(a._id, "1");
});

test("findByAvatarProfileId: 无匹配返回 null（不偷用最新）", async () => {
  const db = makeDB([{ _id: "1", avatar_profile_id: "OTHER", user_id: "u1", updated_at: 1, ...photo }]);
  const r = new Repository(db);
  const a = await r.findByAvatarProfileId("P", "u1");
  assert.equal(a, null);
});

test("findByAvatarProfileId: 跨用户返回 null", async () => {
  const db = makeDB([{ _id: "1", avatar_profile_id: "P", user_id: "u2", updated_at: 1, ...photo }]);
  const r = new Repository(db);
  const a = await r.findByAvatarProfileId("P", "u1");
  assert.equal(a, null);
});

test("findByAvatarProfileId: 多 asset 取 updated_at 最新且具可用照片者", async () => {
  const db = makeDB([
    { _id: "old", avatar_profile_id: "P", user_id: "u1", updated_at: 10, ...photo },
    { _id: "newer-no-photo", avatar_profile_id: "P", user_id: "u1", updated_at: 100 }, // 无照片
    { _id: "newer-photo", avatar_profile_id: "P", user_id: "u1", updated_at: 50, ...photo },
  ]);
  const r = new Repository(db);
  const a = await r.findByAvatarProfileId("P", "u1");
  assert.equal(a._id, "newer-photo"); // 优先"有照片的最新"
});

test("findByAvatarProfileId: 参数缺失返回 null", async () => {
  const r = new Repository(makeDB([]));
  assert.equal(await r.findByAvatarProfileId(null, "u1"), null);
  assert.equal(await r.findByAvatarProfileId("P", null), null);
});

test("findByAvatarProfileId: 全部无照片时返回最新一条（不崩溃）", async () => {
  const db = makeDB([
    { _id: "a", avatar_profile_id: "P", user_id: "u1", updated_at: 1 },
    { _id: "b", avatar_profile_id: "P", user_id: "u1", updated_at: 99 },
  ]);
  const r = new Repository(db);
  const a = await r.findByAvatarProfileId("P", "u1");
  assert.equal(a._id, "b");
});

test("ownership: findById 仅返回同 user_id", async () => {
  const db = {
    collection: () => ({
      doc: () => ({
        get: async () => ({ data: { _id: "1", user_id: "u2" } }),
      }),
    }),
  };
  const r = new Repository(db);
  const a = await r.findById("1", "u1");
  assert.equal(a, null);
});

const test = require("node:test");
const assert = require("node:assert");
const { collectMigrationStats, MIGRATION_COLLECTIONS } = require("./migration");

function fakeDb(store) {
  return {
    collection: (name) => ({
      limit: () => ({
        get: async () => {
          if (!store[name]) throw new Error("no collection");
          return { data: store[name] };
        }
      })
    })
  };
}

test("collectMigrationStats 统计新旧字段覆盖情况", async () => {
  const store = {
    tryon_tasks: [
      { user_id: "u1", created_at: 1, updated_at: 1 },
      { _openid: "u2", createdAt: 2, updatedAt: 2 },
      { createdAt: 3 } // 无归属
    ],
    garments: [
      { user_id: "u1", created_at: 1, updated_at: 1 }
    ]
  };
  const stats = await collectMigrationStats(fakeDb(store));
  assert.strictEqual(stats.tryon_tasks.total, 3);
  assert.strictEqual(stats.tryon_tasks.noUserId, 1);
  assert.strictEqual(stats.tryon_tasks.oldCreatedAt, 2);
  assert.strictEqual(stats.tryon_tasks.oldUpdatedAt, 1);
  assert.strictEqual(stats.tryon_tasks.noUpdatedAt, 1);
  assert.strictEqual(stats.garments.total, 1);
  assert.strictEqual(stats.garments.noUserId, 0);
});

test("MIGRATION_COLLECTIONS 覆盖全部集合", () => {
  for (const c of ["avatar_profiles", "avatar_views", "garments", "garment_views", "tryon_tasks", "tryon_results", "favorites", "quotas", "deletion_jobs"]) {
    assert.ok(MIGRATION_COLLECTIONS.includes(c), c);
  }
});

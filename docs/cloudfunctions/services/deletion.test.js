const test = require("node:test");
const assert = require("node:assert");
const { collectFileIDs, requestDeletion, runDeletion, DELETABLE_COLLECTIONS } = require("./deletion");

function fakeDb(store) {
  return {
    collection: (name) => ({
      doc: (id) => ({
        get: async () => {
          if (store[name] && store[name][id]) return { data: store[name][id] };
          throw new Error("not found");
        },
        update: async ({ data }) => {
          Object.assign(store[name][id], data);
          return { stats: { updated: 1 } };
        },
        remove: async () => {
          delete store[name][id];
          return { stats: { removed: 1 } };
        }
      }),
      where: (q) => ({
        orderBy: () => ({
          limit: () => ({
            get: async () => ({
              data: Object.keys(store[name] || {}).map((k) => store[name][k])
                .filter((d) => !q.user_id || d.user_id === q.user_id)
                .sort((a, b) => (b.created_at || 0) - (a.created_at || 0))
            })
          })
        }),
        limit: () => ({
          get: async () => ({
            data: Object.keys(store[name] || {}).map((k) => store[name][k])
              .filter((d) => !q.user_id || d.user_id === q.user_id)
          })
        })
      }),
      add: async ({ data }) => {
        store[name] = store[name] || {};
        const id = "doc_" + Object.keys(store[name]).length;
        store[name][id] = data;
        return { _id: id };
      }
    })
  };
}

test("collectFileIDs 收集各类云存储字段", () => {
  const ids = collectFileIDs({
    original_file_id: "cloud://a/1.png",
    tryon_image: "cloud://a/2.png",
    face_photo_id: "cloud://a/3.png",
    body_photo_id: "https://x/4.png",
    views: { composite: "cloud://a/5.png" }
  });
  assert.deepStrictEqual(ids.sort(), ["cloud://a/1.png", "cloud://a/2.png", "cloud://a/3.png", "cloud://a/5.png"]);
});

test("requestDeletion: 幂等复用进行中作业", async () => {
  const store = {
    deletion_jobs: {
      j1: { _id: "j1", user_id: "u1", status: "processing", created_at: 100 }
    }
  };
  const r = await requestDeletion(fakeDb(store), "u1");
  assert.strictEqual(r.duplicate, true);
  assert.strictEqual(r.jobId, "j1");
});

test("runDeletion: 删除用户数据与文件并置 completed", async () => {
  const store = {
    deletion_jobs: { j1: { _id: "j1", user_id: "u1", status: "requested" } },
    garments: { g1: { _id: "g1", user_id: "u1", original_file_id: "cloud://a/1.png" } },
    avatar_views: { v1: { _id: "v1", user_id: "u1", views: { composite: "cloud://a/2.png" } } },
    tryon_results: { r1: { _id: "r1", user_id: "u1", tryon_image: "cloud://a/3.png" } }
  };
  const deletedFiles = [];
  const cloud = { deleteFile: async ({ fileList }) => { deletedFiles.push(...fileList); return { fileList: [] }; } };
  const r = await runDeletion(fakeDb(store), cloud, "u1", "j1");
  assert.strictEqual(r.status, "completed");
  assert.strictEqual(store.garments.g1, undefined);
  assert.strictEqual(store.avatar_views.v1, undefined);
  assert.strictEqual(store.tryon_results.r1, undefined);
  assert.strictEqual(store.deletion_jobs.j1.status, "completed");
  assert.strictEqual(deletedFiles.length, 3);
});

test("runDeletion: 跨用户作业 FORBIDDEN", async () => {
  const store = { deletion_jobs: { j1: { _id: "j1", user_id: "u2", status: "requested" } } };
  await assert.rejects(() => runDeletion(fakeDb(store), {}, "u1", "j1"), (e) => e.appCode === "FORBIDDEN");
});

test("DELETABLE_COLLECTIONS 覆盖全部业务集合", () => {
  for (const c of ["avatar_profiles", "avatar_views", "garments", "garment_views", "tryon_tasks", "tryon_results", "favorites", "quotas"]) {
    assert.ok(DELETABLE_COLLECTIONS.includes(c), c);
  }
});

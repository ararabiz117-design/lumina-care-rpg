import test from "node:test";
import assert from "node:assert/strict";
import { createAccountStorage, SAVE_KEY, STATS_KEY } from "../src/cloud-storage.ts";

function memoryStorage() {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key), key: (index) => [...values.keys()][index] ?? null, get length() { return values.size; }, values };
}
const progress = { revision: 0, save: { coins: 0 }, stats: { launches: 0 } };
const result = (revision) => new Response(JSON.stringify({ revision }), { status: 200 });

test("旧匿名セーブを取り込まず、アカウントごとに進捗と設定を分離する", async () => {
  const store = memoryStorage(); store.setItem(SAVE_KEY, JSON.stringify({ coins: 999 }));
  const one = createAccountStorage("one", progress, "csrf", store, async () => result(1), 100_000);
  assert.equal(JSON.parse(one.getItem(SAVE_KEY)).coins, 0);
  one.setItem(SAVE_KEY, JSON.stringify({ coins: 10 })); one.setItem("theme", "rose"); one.dispose();
  const two = createAccountStorage("two", progress, "csrf", store, async () => result(1), 100_000);
  assert.equal(JSON.parse(two.getItem(SAVE_KEY)).coins, 0); assert.equal(two.getItem("theme"), null); two.dispose();
  const restored = createAccountStorage("one", progress, "csrf", store, async () => result(1), 100_000);
  assert.equal(JSON.parse(restored.getItem(SAVE_KEY)).coins, 10); assert.equal(restored.getItem("theme"), "rose"); restored.dispose();
});

test("同期中の追加入力は失われず、更新されたrevisionで次回送信する", async () => {
  const store = memoryStorage(); let finish; const sent = [];
  const adapter = createAccountStorage("one", progress, "csrf-value", store, async (_url, init) => {
    sent.push({ ...JSON.parse(init.body), headers: init.headers });
    if (sent.length === 1) return await new Promise((resolve) => { finish = resolve; });
    return result(2);
  }, 100_000);
  adapter.setItem(SAVE_KEY, JSON.stringify({ coins: 10 }));
  const pending = adapter.flush();
  adapter.setItem(STATS_KEY, JSON.stringify({ launches: 2 }));
  finish(result(1)); await pending;
  assert.equal(adapter.getState().phase, "pending");
  await adapter.flush();
  assert.equal(sent[1].revision, 1); assert.equal(sent[1].stats.launches, 2);
  assert.equal(sent[0].headers["X-CSRF-Token"], "csrf-value");
  assert.equal(adapter.getState().phase, "saved"); adapter.dispose();
});

test("409競合後は再試行でもサーバーを上書きせず、明示選択で端末バックアップする", async () => {
  const store = memoryStorage(); let calls = 0;
  const adapter = createAccountStorage("one", progress, "csrf", store, async () => { calls += 1; return new Response("", { status: 409 }); }, 100_000);
  adapter.setItem(SAVE_KEY, JSON.stringify({ coins: 10 })); await adapter.flush(); adapter.retry(); await adapter.flush();
  assert.equal(calls, 1); assert.equal(adapter.getState().phase, "conflict");
  adapter.useCloudVersion(); assert.equal([...store.values.keys()].filter((key) => key.includes("backup:")).length, 1);
  adapter.dispose();
});

test("再読込時にサーバー側が進んでいれば未同期変更を競合として停止する", () => {
  const store = memoryStorage();
  const old = createAccountStorage("one", progress, "csrf", store, async () => result(1), 100_000);
  old.setItem(SAVE_KEY, JSON.stringify({ coins: 10 })); old.dispose();
  const reopened = createAccountStorage("one", { ...progress, revision: 2 }, "csrf", store, async () => result(3), 100_000);
  assert.equal(reopened.getState().phase, "conflict"); assert.equal(JSON.parse(reopened.getItem(SAVE_KEY)).coins, 10); reopened.dispose();
});

test("認証期限切れは自動リトライせず、通信エラーのみ明示再試行できる", async () => {
  const store = memoryStorage(); let calls = 0;
  const expired = createAccountStorage("one", progress, "csrf", store, async () => { calls += 1; return new Response("", { status: 401 }); }, 100_000);
  expired.setItem(SAVE_KEY, JSON.stringify({ coins: 10 })); await expired.flush(); expired.retry();
  assert.equal(expired.getState().phase, "expired"); assert.equal(calls, 1); expired.dispose();
  let fail = true;
  const offline = createAccountStorage("two", progress, "csrf", store, async () => { if (fail) throw new Error("offline"); return result(1); }, 100_000);
  offline.setItem(SAVE_KEY, JSON.stringify({ coins: 20 })); await offline.flush(); assert.equal(offline.getState().phase, "error");
  fail = false; await offline.flush(); assert.equal(offline.getState().phase, "saved"); offline.dispose();
});

test("アカウント削除は当該アカウントの端末データのみ削除する", () => {
  const store = memoryStorage(); store.setItem("lumina:account:two:theme", "grove"); store.setItem(SAVE_KEY, "legacy");
  const adapter = createAccountStorage("one", progress, "csrf", store, async () => result(1), 100_000);
  adapter.setItem("theme", "rose"); adapter.setItem(SAVE_KEY, JSON.stringify({ coins: 10 })); adapter.useCloudVersion(); adapter.deleteLocal();
  assert.equal([...store.values.keys()].filter((key) => key.startsWith("lumina:account:one:")).length, 0);
  assert.equal(store.getItem("lumina:account:two:theme"), "grove"); assert.equal(store.getItem(SAVE_KEY), "legacy"); adapter.dispose();
});

test("端末の保存失敗を保存済みと表示せず、同期の明示再試行に残す", () => {
  const store = memoryStorage(); store.setItem = () => { throw new Error("storage full"); };
  const adapter = createAccountStorage("one", progress, "csrf", store, async () => result(1), 100_000);
  assert.throws(() => adapter.setItem(SAVE_KEY, JSON.stringify({ coins: 10 })), /storage full/);
  assert.equal(adapter.getState().phase, "error"); assert.equal(JSON.parse(adapter.getItem(SAVE_KEY)).coins, 10); adapter.dispose();
});

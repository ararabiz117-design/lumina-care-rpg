/** Account isolation is intentional: legacy, anonymous saves are never uploaded. */
export const SAVE_KEY = "arablo-lumina-minute-v2";
export const STATS_KEY = "arablo-lumina-stats-v1";
export type Progress = { revision: number; save: unknown; stats: unknown; updatedAt?: string | null };
export type SyncState = { phase: "saved" | "pending" | "syncing" | "error" | "conflict" | "expired"; message: string };
type Store = Pick<Storage, "getItem" | "setItem" | "removeItem"> & Partial<Pick<Storage, "key" | "length">>;
type Fetcher = typeof fetch;
type LocalRecord = { revision: number; dirty: boolean; save: unknown; stats: unknown };
const idle: SyncState = { phase: "saved", message: "保存済み" };

export function createAccountStorage(userId: string, server: Progress, csrfToken: string, storage: Store, request: Fetcher = fetch, delay = 900) {
  if (!userId || !Number.isSafeInteger(server.revision) || server.revision < 0) throw new Error("進捗情報が不正です。");
  const prefix = `lumina:account:${encodeURIComponent(userId)}:`;
  const recordKey = `${prefix}progress`;
  let record: LocalRecord = { revision: server.revision, dirty: false, save: server.save, stats: server.stats };
  let state = idle;
  let stopped = false;
  let inFlight = false;
  let generation = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const listeners = new Set<() => void>();
  const emit = (next: SyncState) => { state = next; listeners.forEach((listener) => listener()); };
  try {
    const raw = storage.getItem(recordKey);
    const local = raw ? JSON.parse(raw) as LocalRecord : null;
    if (local?.dirty && Number.isSafeInteger(local.revision) && local.revision >= 0) {
      record = local;
      state = local.revision === server.revision
        ? { phase: "pending", message: "この端末に未同期の変更があります" }
        : { phase: "conflict", message: "別の端末の進捗と競合しています。この端末の変更は保持されています。" };
    }
  } catch { throw new Error("端末内の進捗を読み込めませんでした。保存済みの変更を保護するため停止しています。"); }
  const persist = () => storage.setItem(recordKey, JSON.stringify(record));
  const flush = async () => {
    if (stopped || inFlight || !record.dirty || state.phase === "conflict" || state.phase === "expired") return;
    inFlight = true;
    const sentGeneration = generation;
    const payload = { revision: record.revision, save: record.save, stats: record.stats };
    emit({ phase: "syncing", message: "同期中" });
    try {
      const response = await request("/api/progress", { method: "PUT", credentials: "same-origin", signal: AbortSignal.timeout(15_000), headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken }, body: JSON.stringify(payload) });
      if (stopped) return;
      if (response.status === 401 || response.status === 403) {
        emit({ phase: "expired", message: "ログインを確認してください。変更はこの端末に保持されています。" });
        return;
      }
      if (response.status === 409) {
        emit({ phase: "conflict", message: "別の端末の進捗と競合しています。この端末の変更は保持されています。" });
        return;
      }
      if (!response.ok) throw new Error("同期に失敗しました");
      const result = await response.json() as Progress;
      if (!Number.isSafeInteger(result.revision) || result.revision <= payload.revision) throw new Error("同期の応答が不正です");
      record = { ...record, revision: result.revision, dirty: generation !== sentGeneration };
      try { persist(); } catch (error) { record.dirty = true; throw error; }
      emit(record.dirty ? { phase: "pending", message: "未同期の変更があります" } : idle);
    } catch {
      if (!stopped) emit({ phase: "error", message: "同期を確認できません。画面を閉じる前に再試行してください。" });
    } finally {
      inFlight = false;
      if (!stopped && record.dirty && state.phase === "pending") schedule();
    }
  };
  const schedule = () => {
    if (timer) clearTimeout(timer);
    if (["conflict", "expired", "error"].includes(state.phase) || stopped) return;
    timer = setTimeout(() => { void flush(); }, delay);
  };
  return {
    getItem(key: string): string | null {
      if (key === SAVE_KEY) return record.save == null ? null : JSON.stringify(record.save);
      if (key === STATS_KEY) return record.stats == null ? null : JSON.stringify(record.stats);
      return storage.getItem(`${prefix}${key}`);
    },
    setItem(key: string, value: string) {
      if (stopped) return;
      if (key !== SAVE_KEY && key !== STATS_KEY) { storage.setItem(`${prefix}${key}`, value); return; }
      const parsed: unknown = JSON.parse(value);
      const field = key === SAVE_KEY ? "save" : "stats";
      if (JSON.stringify(record[field]) === value) return;
      record = { ...record, [field]: parsed, dirty: true };
      generation += 1;
      try { persist(); } catch (error) {
        emit({ phase: "error", message: "この端末に保存できません。画面を閉じる前に同期を再試行してください。" });
        throw error;
      }
      if (!["conflict", "expired", "error"].includes(state.phase)) emit({ phase: "pending", message: "未同期の変更があります" });
      schedule();
    },
    getState: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    retry() { if (["error", "pending"].includes(state.phase)) { emit({ phase: "pending", message: "未同期の変更があります" }); void flush(); } },
    async flush() { await flush(); },
    dispose() { stopped = true; if (timer) clearTimeout(timer); listeners.clear(); },
    useCloudVersion() {
      // Explicit conflict resolution does not overwrite either side.
      storage.setItem(`${prefix}backup:latest`, JSON.stringify(record));
      storage.removeItem(recordKey);
    },
    deleteLocal() {
      const keys: string[] = [];
      if (storage.key && typeof storage.length === "number") {
        for (let index = 0; index < storage.length; index += 1) {
          const key = storage.key(index);
          if (key?.startsWith(prefix)) keys.push(key);
        }
      }
      keys.forEach((key) => storage.removeItem(key));
      storage.removeItem(recordKey);
    },
  };
}
export type AccountStorage = ReturnType<typeof createAccountStorage>;
let active: AccountStorage | null = null;
export function setAccountStorage(value: AccountStorage | null) { active?.dispose(); active = value; }
export const appStorage = {
  getItem(key: string) { if (!active) throw new Error("ログインが必要です"); return active.getItem(key); },
  setItem(key: string, value: string) { if (!active) throw new Error("ログインが必要です"); active.setItem(key, value); },
};

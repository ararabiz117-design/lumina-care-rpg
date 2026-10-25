import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { MinuteJourney } from "../app/lumina/MinuteJourney";
import content from "../data/lumina-minute-lessons.json";
import { readJourneyStats, readSave, type Lesson } from "../app/lumina/minute-engine";
import { createAccountStorage, setAccountStorage, type AccountStorage, type Progress } from "./cloud-storage";
import "./auth.css";

type User = { id: string; name: string; picture?: string };
type Session = { authenticated: boolean; user: User | null; csrfToken: string; configuration: { google: boolean; database: boolean } };
type Screen = { kind: "loading" } | { kind: "error"; message: string } | { kind: "login"; session: Session } | { kind: "app"; session: Session; storage: AccountStorage };
const lessons = content.lessons as Lesson[];

export function getAuthNotice(search: string) {
  const params = new URLSearchParams(search);
  if (params.get("auth") === "cancelled") return { role: "status" as const, text: "Googleログインをキャンセルしました。準備ができたら、もう一度ログインできます。" };
  if (params.get("auth") === "failed" || params.has("error")) return { role: "alert" as const, text: "Googleログインが完了しませんでした。もう一度お試しください。" };
  return null;
}

function FullSkeleton() {
  return <main className="auth-skeleton" aria-busy="true" aria-label="読み込み中"><div className="skeleton-bar"/><div className="skeleton-layout"><div className="skeleton-nav"/><div className="skeleton-content"><div className="skeleton-title"/><div className="skeleton-card"/><div className="skeleton-row"><i/><i/><i/></div><div className="skeleton-card short"/></div></div><span className="sr-only">読み込み中</span></main>;
}
function AccountPanel({ session, storage, onExit, onBlockChange }: { session: Session; storage: AccountStorage; onExit: () => void; onBlockChange: (value: boolean) => void }) {
  const sync = useSyncExternalStore(storage.subscribe, storage.getState, storage.getState);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [cloudConfirmation, setCloudConfirmation] = useState(false);
  const [logoutConfirmation, setLogoutConfirmation] = useState(false);
  const dialogRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const blocking = sync.phase === "conflict" || sync.phase === "expired";
  useEffect(() => { onBlockChange(open || blocking); }, [open, blocking, onBlockChange]);
  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    dialog?.querySelector<HTMLButtonElement>("button")?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) { setOpen(false); triggerRef.current?.focus(); }
      if (event.key !== "Tab" || !dialog) return;
      const nodes = Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),a[href]'));
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", handleKey);
    return () => { document.removeEventListener("keydown", handleKey); };
  }, [open, busy]);
  async function logout(force = false) {
    setBusy(true); setMessage("");
    try {
      await storage.flush();
      if (storage.getState().phase !== "saved" && !force) { setLogoutConfirmation(true); setBusy(false); return; }
      const response = await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin", headers: { "X-CSRF-Token": session.csrfToken } });
      if (!response.ok) throw new Error();
      onExit();
    } catch { setMessage("ログアウトできませんでした。もう一度お試しください。"); setBusy(false); }
  }
  async function deleteAccount() {
    if (confirmation !== "DELETE") return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/account", { method: "DELETE", credentials: "same-origin", headers: { "X-CSRF-Token": session.csrfToken } });
      if (!response.ok) throw new Error();
      storage.deleteLocal();
      onExit();
    } catch { setMessage("アカウントを削除できませんでした。再ログイン後にお試しください。"); setBusy(false); }
  }
  return <>
    <div className="account-bar"><span className={`sync-status ${sync.phase}`} role="status"><i/>{sync.message}</span><button ref={triggerRef} className="account-trigger" onClick={() => setOpen(!open)} aria-expanded={open}>{session.user?.name || "アカウント"}<span aria-hidden="true">⌄</span></button></div>
    {(["pending", "error"].includes(sync.phase)) && <div className="sync-notice"><span>未同期の進捗はこの端末に保存されます。</span><button onClick={() => storage.retry()}>同期する</button></div>}
    {blocking && <section className="sync-blocker" aria-labelledby="sync-title"><div><h2 id="sync-title">{sync.phase === "conflict" ? "進捗の競合" : "ログインの確認"}</h2><p>{sync.message}</p>{sync.phase === "conflict" && <><p>他の端末の進捗を上書きしません。クラウド側を選ぶと、この端末の未同期変更は適用されません。端末内のバックアップは保持します。</p>{cloudConfirmation ? <><p>クラウド側の進捗で再開しますか？</p><button onClick={() => { try { storage.useCloudVersion(); location.reload(); } catch { setMessage("端末内のバックアップに失敗しました。変更は保持されています。"); } }}>クラウド側の進捗で再開する</button><button onClick={() => setCloudConfirmation(false)}>キャンセル</button></> : <button onClick={() => setCloudConfirmation(true)}>クラウド側の進捗を使う</button>}</>}<button onClick={() => location.reload()}>再読み込み</button><button onClick={() => setOpen(true)}>アカウントを開く</button>{message && <p role="alert">{message}</p>}</div></section>}
    {open && <div className="account-overlay" onClick={(event) => { if (event.target === event.currentTarget && !busy) setOpen(false); }}>
      <section ref={dialogRef} className="account-dialog" role="dialog" aria-modal="true" aria-labelledby="account-title">
        <div className="dialog-heading"><h2 id="account-title">アカウント</h2><button onClick={() => setOpen(false)} aria-label="閉じる" disabled={busy}>×</button></div>
        <p className="account-name">{session.user?.name}</p><p className="account-note">Google認証・端末ごとに進捗を同期</p>
        <button className="account-action" onClick={() => { void logout(); }} disabled={busy}>ログアウト</button>
        {logoutConfirmation && <div className="deletion-confirm"><p>クラウドに同期されていない変更があります。変更はこの端末の、このGoogleアカウント専用領域に残ります。他の端末には反映されません。</p><div className="deletion-actions"><button onClick={() => setLogoutConfirmation(false)} disabled={busy}>キャンセル</button><button onClick={() => { void logout(true); }} disabled={busy}>未同期のままログアウト</button></div></div>}
        <button className="account-delete" onClick={() => setDeleting(true)} disabled={busy}>アカウントを削除</button>
        {deleting && <div className="deletion-confirm"><h3>削除は取り消せません</h3><p>アカウントとクラウド上の学習進捗を削除します。このGoogleアカウント自体は削除されません。</p><label htmlFor="delete-confirm">確認のため DELETE と入力</label><input id="delete-confirm" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" spellCheck={false}/><div className="deletion-actions"><button onClick={() => { setDeleting(false); setConfirmation(""); }} disabled={busy}>キャンセル</button><button className="danger-button" onClick={deleteAccount} disabled={busy || confirmation !== "DELETE"}>完全に削除する</button></div></div>}
        {message && <p role="alert">{message}</p>}{busy && <p role="status">処理中…</p>}
      </section>
    </div>}
  </>;
}

export function AuthApp() {
  const [screen, setScreen] = useState<Screen>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [gameBlocked, setGameBlocked] = useState(false);
  useEffect(() => {
    let live = true;
    let ownedStorage: AccountStorage | null = null;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20_000);
    setScreen({ kind: "loading" });
    async function load() {
      try {
        const response = await fetch("/api/auth/session", { credentials: "same-origin", cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("ログイン情報を取得できませんでした。");
        const session = await response.json() as Session;
        if (!live) return;
        if (!session.authenticated || !session.user) { setScreen({ kind: "login", session }); return; }
        if (!session.configuration.database) throw new Error("Cloudflare D1 の設定が完了していません。");
        const progressResponse = await fetch("/api/progress", { credentials: "same-origin", cache: "no-store", signal: controller.signal });
        if (!progressResponse.ok) throw new Error("学習進捗を取得できませんでした。既存の進捗を保護するため、読み込みを停止しています。");
        const progress = await progressResponse.json() as Progress;
        progress.save = readSave(progress.save == null ? null : JSON.stringify(progress.save), lessons);
        progress.stats = readJourneyStats(progress.stats == null ? null : JSON.stringify(progress.stats));
        if (!live) return;
        ownedStorage = createAccountStorage(session.user.id, progress, session.csrfToken, localStorage);
        setAccountStorage(ownedStorage);
        setScreen({ kind: "app", session, storage: ownedStorage });
      } catch (error) { if (live) setScreen({ kind: "error", message: controller.signal.aborted ? "読み込みがタイムアウトしました。接続を確認してもう一度お試しください。" : error instanceof Error ? error.message : "読み込みに失敗しました。" }); }
      finally { window.clearTimeout(timeout); }
    }
    void load();
    return () => { live = false; window.clearTimeout(timeout); controller.abort(); ownedStorage?.dispose(); setAccountStorage(null); };
  }, [attempt]);
  if (screen.kind === "loading") return <FullSkeleton/>;
  if (screen.kind === "error") return <main className="auth-page"><section className="auth-card"><p className="auth-wordmark">LUMINA</p><h1>読み込みできませんでした</h1><p role="alert">{screen.message}</p><button className="google-button" onClick={() => setAttempt((value) => value + 1)}>もう一度読み込む</button></section></main>;
  if (screen.kind === "login") {
    const configured = screen.session.configuration.google && screen.session.configuration.database;
    const notice = getAuthNotice(location.search);
    return <main className="auth-page"><div className="auth-halo" aria-hidden="true"/><section className="auth-card"><div className="auth-symbol" aria-hidden="true">✦</div><p className="auth-wordmark">LUMINA</p><h1>介護福祉士 学習アプリ</h1>{notice && <p className={notice.role === "alert" ? "auth-error" : "auth-privacy"} role={notice.role}>{notice.text}</p>}{configured ? <a className="google-button" href="/api/auth/google/start?returnTo=%2Flumina%2F"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21.6 12.2c0-.7-.1-1.4-.2-2.1H12v4h5.4a4.7 4.7 0 0 1-2 3.1v2.6h3.3c1.9-1.8 2.9-4.3 2.9-7.6ZM12 22c2.7 0 5-.9 6.7-2.4l-3.3-2.6c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3v2.6A10 10 0 0 0 12 22ZM6.4 13.9a6 6 0 0 1 0-3.8V7.5H3a10 10 0 0 0 0 9l3.4-2.6ZM12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.8A9.6 9.6 0 0 0 12 2 10 10 0 0 0 3 7.5l3.4 2.6A6 6 0 0 1 12 6Z"/></svg>Googleでログイン</a> : <div className="auth-configuration" role="status"><strong>公開準備中</strong><p>{!screen.session.configuration.google && "Google認証が未設定です。"}{!screen.session.configuration.database && "Cloudflare D1 が未設定です。"}</p><button onClick={() => setAttempt((value) => value + 1)}>設定を再確認</button></div>}<p className="auth-privacy">学習進捗・装備・学習記録をアカウントに保存します。</p><nav className="auth-links" aria-label="利用案内"><a href="/privacy/">プライバシーポリシー</a><a href="/terms/">利用規約</a></nav></section></main>;
  }
  return <><AccountPanel session={screen.session} storage={screen.storage} onBlockChange={setGameBlocked} onExit={() => { setAccountStorage(null); setAttempt((value) => value + 1); }}/><div className="authenticated-game" inert={gameBlocked}><MinuteJourney/></div></>;
}

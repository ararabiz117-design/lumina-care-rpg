import lessonData from "../data/lumina-minute-lessons.json" with { type: "json" };
import { emptySave, emptyJourneyStats, readJourneyStats, readSave, type Lesson } from "../app/lumina/minute-engine.ts";
import { SESSION_COOKIE, OAUTH_COOKIE, SESSION_TTL, OAUTH_TTL, randomToken, hashToken, equalToken, cookieValue, configuredOrigin, cookie, sameOrigin, safeReturnTo, csrfToken, validateGoogleToken } from "./security.ts";

type Statement = {
  bind(...values: unknown[]): Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<unknown>;
};
export type Database = { prepare(sql: string): Statement; batch(statements: Statement[]): Promise<unknown[]> };
export type Env = {
  ASSETS: { fetch(request: Request): Promise<Response> };
  DB?: Database;
  APP_ORIGIN?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  AUTH_RATE_LIMITER?: { limit(input: { key: string }): Promise<{ success: boolean }> };
};
type Session = { token: string; tokenHash: string; id: string; name: string; picture: string | null };
type ProgressRow = { revision: number; save_json: string; stats_json: string; updated_at: number };
type OAuthState = { verifier: string; nonce: string; return_to: string; expires_at: number };
const lessons = (Array.isArray(lessonData) ? lessonData : (lessonData as { lessons: Lesson[] }).lessons) as Lesson[];
const nowSeconds = () => Math.floor(Date.now() / 1000);

function json(value: unknown, status = 200, extra?: HeadersInit): Response {
  const headers = new Headers(extra);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("X-Frame-Options", "DENY");
  return new Response(JSON.stringify(value), { status, headers });
}
function redirect(location: string, cookies: string[] = []): Response {
  const headers = new Headers({ Location: location, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" });
  cookies.forEach(value => headers.append("Set-Cookie", value));
  return new Response(null, { status: 302, headers });
}
function unavailable(): Response {
  return json({ error: "configuration_required", message: "Googleログインの設定がまだ完了していません。管理者による設定が必要です。" }, 503);
}
function configuration(env: Env) {
  return { google: Boolean(configuredOrigin(env.APP_ORIGIN) && env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.DB), database: Boolean(env.DB) };
}
async function sessionFor(request: Request, env: Env): Promise<Session | null> {
  if (!env.DB) return null;
  const token = cookieValue(request, SESSION_COOKIE);
  if (!token) return null;
  const tokenHash = await hashToken(token);
  const user = await env.DB.prepare("SELECT users.id, users.name, users.picture FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token_hash = ? AND sessions.expires_at > ?").bind(tokenHash, nowSeconds()).first<{ id: string; name: string; picture: string | null }>();
  return user ? { ...user, token, tokenHash } : null;
}
async function protectedSession(request: Request, env: Env): Promise<Session | Response> {
  const origin = configuredOrigin(env.APP_ORIGIN);
  if (!origin || !env.DB) return unavailable();
  if (!sameOrigin(request, origin)) return json({ error: "origin_rejected" }, 403);
  const session = await sessionFor(request, env);
  if (!session) return json({ error: "authentication_required" }, 401);
  const token = request.headers.get("X-CSRF-Token") ?? "";
  if (!equalToken(token, await csrfToken(session.token))) return json({ error: "csrf_rejected" }, 403);
  return session;
}
function progressValue(row: ProgressRow | null) {
  return row ? { revision: row.revision, save: readSave(row.save_json, lessons), stats: readJourneyStats(row.stats_json), updatedAt: row.updated_at } : { revision: 0, save: emptySave(), stats: emptyJourneyStats(), updatedAt: null };
}
async function getProgress(env: Env, userId: string) {
  return env.DB!.prepare("SELECT revision, save_json, stats_json, updated_at FROM progress WHERE user_id = ?").bind(userId).first<ProgressRow>();
}
async function readLimitedJson(request: Request): Promise<unknown> {
  if (request.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase() !== "application/json") throw new Error("content_type");
  const max = 131072;
  if (Number(request.headers.get("Content-Length")) > max) throw new Error("body_too_large");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("invalid_json");
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) { await reader.cancel(); throw new Error("body_too_large"); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder().decode(bytes));
}

async function startGoogle(request: Request, env: Env): Promise<Response> {
  if (!configuration(env).google) return unavailable();
  const origin = configuredOrigin(env.APP_ORIGIN)!;
  if (new URL(request.url).origin !== origin) return json({ error: "origin_rejected" }, 403);
  if (env.AUTH_RATE_LIMITER) {
    const clientKey = await hashToken(`oauth-start:${request.headers.get("CF-Connecting-IP") ?? "local"}`);
    if (!(await env.AUTH_RATE_LIMITER.limit({ key: clientKey })).success) return json({ error: "rate_limited", message: "少し待ってからログインしてください。" }, 429, { "Retry-After": "60" });
  }
  const state = randomToken();
  const verifier = randomToken();
  const nonce = randomToken();
  const returnTo = safeReturnTo(new URL(request.url).searchParams.get("returnTo"));
  const now = nowSeconds();
  await env.DB!.batch([
    env.DB!.prepare("DELETE FROM oauth_states WHERE expires_at <= ?").bind(now),
    env.DB!.prepare("INSERT INTO oauth_states (state_hash, verifier, nonce, return_to, expires_at) VALUES (?, ?, ?, ?, ?)").bind(await hashToken(state), verifier, nonce, returnTo, now + OAUTH_TTL),
  ]);
  const authorization = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorization.search = new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID!, redirect_uri: `${origin}/api/auth/google/callback`, response_type: "code", scope: "openid profile", state, nonce, code_challenge: await hashToken(verifier), code_challenge_method: "S256", prompt: "select_account" }).toString();
  return redirect(authorization.href, [cookie(OAUTH_COOKIE, state, origin, OAUTH_TTL)]);
}

async function finishGoogle(request: Request, env: Env): Promise<Response> {
  if (!configuration(env).google) return unavailable();
  const origin = configuredOrigin(env.APP_ORIGIN)!;
  const url = new URL(request.url);
  if (url.origin !== origin) return json({ error: "origin_rejected" }, 403);
  const clear = cookie(OAUTH_COOKIE, "", origin, 0);
  const state = url.searchParams.get("state") ?? "";
  const browserState = cookieValue(request, OAUTH_COOKIE);
  if (!browserState || !equalToken(state, browserState)) return redirect(`${origin}/lumina/?auth=failed`, [clear]);
  // DELETE RETURNING atomically consumes the transaction, including denied or failed logins.
  const flow = await env.DB!.prepare("DELETE FROM oauth_states WHERE state_hash = ? RETURNING verifier, nonce, return_to, expires_at").bind(await hashToken(state)).first<OAuthState>();
  if (!flow || flow.expires_at <= nowSeconds()) return redirect(`${origin}/lumina/?auth=failed`, [clear]);
  if (url.searchParams.has("error")) return redirect(`${origin}/lumina/?auth=cancelled`, [clear]);
  const code = url.searchParams.get("code");
  if (!code || code.length > 4096) return redirect(`${origin}/lumina/?auth=failed`, [clear]);
  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: env.GOOGLE_CLIENT_ID!, client_secret: env.GOOGLE_CLIENT_SECRET!, redirect_uri: `${origin}/api/auth/google/callback`, grant_type: "authorization_code", code_verifier: flow.verifier }),
      signal: AbortSignal.timeout(10000),
    });
    if (!tokenResponse.ok) throw new Error("Token exchange failed");
    const tokens = await tokenResponse.json() as { id_token?: unknown };
    if (typeof tokens.id_token !== "string" || tokens.id_token.length > 16384) throw new Error("Missing identity token");
    const identity = await validateGoogleToken(tokens.id_token, env.GOOGLE_CLIENT_ID!, flow.nonce);
    const now = nowSeconds();
    const user = await env.DB!.prepare("INSERT INTO users (id, google_sub, name, picture, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(google_sub) DO UPDATE SET name = excluded.name, picture = excluded.picture, updated_at = excluded.updated_at RETURNING id").bind(crypto.randomUUID(), identity.sub, identity.name, identity.picture, now, now).first<{ id: string }>();
    if (!user) throw new Error("Account creation failed");
    const token = randomToken();
    const previous = cookieValue(request, SESSION_COOKIE);
    const statements = [
      env.DB!.prepare("DELETE FROM sessions WHERE expires_at <= ?").bind(now),
      env.DB!.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)").bind(await hashToken(token), user.id, now + SESSION_TTL),
    ];
    if (previous) statements.push(env.DB!.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await hashToken(previous)));
    await env.DB!.batch(statements);
    return redirect(`${origin}${safeReturnTo(flow.return_to)}`, [clear, cookie(SESSION_COOKIE, token, origin, SESSION_TTL)]);
  } catch {
    // Never return provider errors, tokens, codes, or stack traces to the client/logs.
    return redirect(`${origin}/lumina/?auth=failed`, [clear]);
  }
}

export async function handleApi(request: Request, env: Env): Promise<Response> {
  const path = new URL(request.url).pathname;
  if (path === "/api/auth/session" && request.method === "GET") {
    const session = await sessionFor(request, env);
    return json({ authenticated: Boolean(session), user: session ? { id: session.id, name: session.name, picture: session.picture } : null, csrfToken: session ? await csrfToken(session.token) : null, configuration: configuration(env) });
  }
  if (path === "/api/auth/google/start" && request.method === "GET") return startGoogle(request, env);
  if (path === "/api/auth/google/callback" && request.method === "GET") return finishGoogle(request, env);
  if (path === "/api/progress" && request.method === "GET") {
    if (!env.DB) return unavailable();
    const session = await sessionFor(request, env);
    return session ? json(progressValue(await getProgress(env, session.id))) : json({ error: "authentication_required" }, 401);
  }
  if ((path === "/api/auth/logout" && request.method === "POST") || (path === "/api/account" && request.method === "DELETE") || (path === "/api/progress" && request.method === "PUT")) {
    const session = await protectedSession(request, env);
    if (session instanceof Response) return session;
    if (path === "/api/auth/logout") {
      await env.DB!.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(session.tokenHash).run();
      return json({ ok: true }, 200, { "Set-Cookie": cookie(SESSION_COOKIE, "", configuredOrigin(env.APP_ORIGIN)!, 0) });
    }
    if (path === "/api/account") {
      // Explicit deletion protects even when the database was created without foreign_keys enabled.
      await env.DB!.batch([
        env.DB!.prepare("DELETE FROM progress WHERE user_id = ?").bind(session.id),
        env.DB!.prepare("DELETE FROM sessions WHERE user_id = ?").bind(session.id),
        env.DB!.prepare("DELETE FROM users WHERE id = ?").bind(session.id),
      ]);
      return json({ ok: true }, 200, { "Set-Cookie": cookie(SESSION_COOKIE, "", configuredOrigin(env.APP_ORIGIN)!, 0) });
    }
    let input: unknown;
    try { input = await readLimitedJson(request); } catch (error) {
      return json({ error: error instanceof Error && error.message === "body_too_large" ? "body_too_large" : "invalid_json" }, error instanceof Error && error.message === "body_too_large" ? 413 : 400);
    }
    if (!input || typeof input !== "object" || Array.isArray(input)) return json({ error: "invalid_progress" }, 400);
    const value = input as Record<string, unknown>;
    if (!Number.isSafeInteger(value.revision) || (value.revision as number) < 0 || (value.revision as number) >= Number.MAX_SAFE_INTEGER || !value.save || typeof value.save !== "object" || Array.isArray(value.save) || !value.stats || typeof value.stats !== "object" || Array.isArray(value.stats)) return json({ error: "invalid_progress" }, 400);
    const save = readSave(JSON.stringify(value.save), lessons);
    const stats = readJourneyStats(JSON.stringify(value.stats));
    const row = await env.DB!.prepare("INSERT INTO progress (user_id, revision, save_json, stats_json, updated_at) SELECT ?, ?, ?, ?, ? WHERE ? = 0 OR EXISTS (SELECT 1 FROM progress WHERE user_id = ? AND revision = ?) ON CONFLICT(user_id) DO UPDATE SET revision = excluded.revision, save_json = excluded.save_json, stats_json = excluded.stats_json, updated_at = excluded.updated_at WHERE progress.revision = excluded.revision - 1 RETURNING revision, save_json, stats_json, updated_at").bind(session.id, (value.revision as number) + 1, JSON.stringify(save), JSON.stringify(stats), nowSeconds(), value.revision, session.id, value.revision).first<ProgressRow>();
    if (!row) return json({ error: "revision_conflict", ...progressValue(await getProgress(env, session.id)) }, 409);
    return json(progressValue(row));
  }
  return json({ error: "not_found" }, 404);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (path === "/api" || path.startsWith("/api/")) {
      try { return await handleApi(request, env); }
      catch { return json({ error: "service_unavailable", message: "現在同期できません。端末内の学習データは保持されます。" }, 503); }
    }
    return env.ASSETS.fetch(request);
  },
};

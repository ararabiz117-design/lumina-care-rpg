import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { generateKeyPair, SignJWT, createLocalJWKSet, exportJWK } from "jose";
import worker, { handleApi } from "../server/index.ts";
import { hashToken, csrfToken, cookie, cookieValue, configuredOrigin, safeReturnTo, validateGoogleToken } from "../server/security.ts";
import { emptySave, emptyJourneyStats } from "../app/lumina/minute-engine.ts";

const ORIGIN = "https://lumina.example";
const TOKEN_A = "a".repeat(43);
const TOKEN_B = "b".repeat(43);
const now = () => Math.floor(Date.now() / 1000);

function database() {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync(new URL("../migrations/0001_identity_and_progress.sql", import.meta.url), "utf8"));
  return {
    db,
    prepare(sql) {
      const prepared = db.prepare(sql);
      let args = [];
      const statement = {
        bind(...values) { args = values; return statement; },
        async first() { return prepared.get(...args) ?? null; },
        async run() { return prepared.run(...args); },
      };
      return statement;
    },
    async batch(statements) {
      db.exec("BEGIN");
      try { const results = []; for (const statement of statements) results.push(await statement.run()); db.exec("COMMIT"); return results; }
      catch (error) { db.exec("ROLLBACK"); throw error; }
    },
  };
}
async function fixture() {
  const DB = database();
  for (const [id, token] of [["user-a", TOKEN_A], ["user-b", TOKEN_B]]) {
    DB.db.prepare("INSERT INTO users (id, google_sub, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)").run(id, `google-${id}`, id, now(), now());
    DB.db.prepare("INSERT INTO sessions VALUES (?, ?, ?)").run(await hashToken(token), id, now() + 1000);
  }
  return { DB, APP_ORIGIN: ORIGIN, GOOGLE_CLIENT_ID: "test-client", GOOGLE_CLIENT_SECRET: "test-secret", ASSETS: { fetch: async () => new Response("assets") } };
}
async function authenticated(path, method = "GET", token = TOKEN_A, value, extra = {}) {
  return new Request(`${ORIGIN}${path}`, {
    method,
    headers: { Cookie: `lumina_session=${token}`, Origin: ORIGIN, "Content-Type": "application/json", "X-CSRF-Token": await csrfToken(token), ...extra },
    ...(value === undefined ? {} : { body: JSON.stringify(value) }),
  });
}

test("configuration missing never impersonates a logged-in user", async () => {
  const env = { ASSETS: { fetch: async () => new Response("assets") } };
  const session = await handleApi(new Request(`${ORIGIN}/api/auth/session`), env);
  assert.deepEqual(await session.json(), { authenticated: false, user: null, csrfToken: null, configuration: { google: false, database: false } });
  assert.equal(session.headers.get("cache-control"), "no-store");
  assert.equal((await handleApi(new Request(`${ORIGIN}/api/auth/google/start`), env)).status, 503);
  assert.equal((await worker.fetch(new Request(`${ORIGIN}/lumina/`), env)).status, 200);
});

test("session exposes opaque identity and CSRF but never Google sub or raw session token", async () => {
  const env = await fixture();
  const response = await handleApi(await authenticated("/api/auth/session"), env);
  const data = await response.json();
  assert.equal(data.user.id, "user-a");
  assert.equal(data.csrfToken, await csrfToken(TOKEN_A));
  assert.ok(!JSON.stringify(data).includes(TOKEN_A));
  assert.ok(!JSON.stringify(data).includes("google-user"));
  env.DB.db.prepare("UPDATE sessions SET expires_at = 0").run();
  assert.equal((await (await handleApi(await authenticated("/api/auth/session"), env)).json()).authenticated, false);
  env.DB.db.close();
});

test("mutations require exact Origin and CSRF before making changes", async () => {
  const env = await fixture();
  for (const extra of [{ Origin: "https://attacker.example" }, { Origin: "null" }, { "X-CSRF-Token": "wrong" }, { "Sec-Fetch-Site": "cross-site" }]) {
    assert.equal((await handleApi(await authenticated("/api/auth/logout", "POST", TOKEN_A, undefined, extra), env)).status, 403);
  }
  assert.equal(env.DB.db.prepare("SELECT COUNT(*) AS n FROM sessions").get().n, 2);
  assert.equal((await handleApi(new Request(`${ORIGIN}/api/progress`, { method: "PUT", headers: { Origin: ORIGIN } }), env)).status, 401);
  env.DB.db.close();
});

test("progress is partitioned, normalized and compare-and-swap rejects stale and nonexistent revisions", async () => {
  const env = await fixture();
  const payload = { revision: 9, save: emptySave(), stats: emptyJourneyStats() };
  const missing = await handleApi(await authenticated("/api/progress", "PUT", TOKEN_A, payload), env);
  assert.equal(missing.status, 409);
  payload.revision = 0;
  payload.save.coins = -100;
  payload.save.completed = ["made-up"];
  payload.stats.appForegroundMs = -1;
  const first = await handleApi(await authenticated("/api/progress", "PUT", TOKEN_A, payload), env);
  assert.equal(first.status, 200);
  const data = await first.json();
  assert.equal(data.revision, 1);
  assert.equal(data.save.coins, 0);
  assert.deepEqual(data.save.completed, []);
  assert.equal(data.stats.appForegroundMs, 0);
  const other = await (await handleApi(await authenticated("/api/progress", "GET", TOKEN_B), env)).json();
  assert.equal(other.revision, 0);
  const stale = await handleApi(await authenticated("/api/progress", "PUT", TOKEN_A, payload), env);
  assert.equal(stale.status, 409);
  assert.equal((await stale.json()).revision, 1);
  payload.revision = 1;
  assert.equal((await (await handleApi(await authenticated("/api/progress", "PUT", TOKEN_A, payload), env)).json()).revision, 2);
  env.DB.db.close();
});

test("oversized and malformed uploads do not change progress", async () => {
  const env = await fixture();
  const oversized = await authenticated("/api/progress", "PUT", TOKEN_A, { text: "x".repeat(131073) });
  assert.equal((await handleApi(oversized, env)).status, 413);
  assert.equal((await handleApi(await authenticated("/api/progress", "PUT", TOKEN_A, []), env)).status, 400);
  assert.equal(env.DB.db.prepare("SELECT COUNT(*) AS n FROM progress").get().n, 0);
  env.DB.db.close();
});

test("logout revokes only current session and account deletion removes owned records only", async () => {
  const env = await fixture();
  const payload = { revision: 0, save: emptySave(), stats: emptyJourneyStats() };
  for (const token of [TOKEN_A, TOKEN_B]) await handleApi(await authenticated("/api/progress", "PUT", token, payload), env);
  const deleted = await handleApi(await authenticated("/api/account", "DELETE"), env);
  assert.equal(deleted.status, 200);
  assert.match(deleted.headers.get("set-cookie"), /Max-Age=0/);
  assert.equal(env.DB.db.prepare("SELECT COUNT(*) AS n FROM users").get().n, 1);
  assert.equal(env.DB.db.prepare("SELECT COUNT(*) AS n FROM progress").get().n, 1);
  assert.equal((await handleApi(await authenticated("/api/progress"), env)).status, 401);
  const logout = await handleApi(await authenticated("/api/auth/logout", "POST", TOKEN_B), env);
  assert.equal(logout.status, 200);
  assert.equal(env.DB.db.prepare("SELECT COUNT(*) AS n FROM sessions").get().n, 0);
  env.DB.db.close();
});

test("OAuth uses S256/nonce, stores state hash and prevents mismatched/expired/replayed callbacks", async () => {
  const env = await fixture();
  const start = await handleApi(new Request(`${ORIGIN}/api/auth/google/start?returnTo=https://attacker.example`), env);
  assert.equal(start.status, 302);
  const auth = new URL(start.headers.get("location"));
  assert.equal(auth.origin, "https://accounts.google.com");
  assert.equal(auth.searchParams.get("code_challenge_method"), "S256");
  assert.equal(auth.searchParams.get("scope"), "openid profile");
  const state = auth.searchParams.get("state");
  const row = env.DB.db.prepare("SELECT * FROM oauth_states").get();
  assert.equal(row.state_hash, await hashToken(state));
  assert.equal(row.return_to, "/lumina/");
  assert.equal(auth.searchParams.get("code_challenge"), await hashToken(row.verifier));
  assert.equal(auth.searchParams.get("nonce"), row.nonce);
  const callback = (actualState, actualCookie) => new Request(`${ORIGIN}/api/auth/google/callback?state=${actualState}&error=access_denied`, { headers: { Cookie: `lumina_oauth=${actualCookie}` } });
  assert.match((await handleApi(callback(state, "z".repeat(43)), env)).headers.get("location"), /auth=failed/);
  assert.equal(env.DB.db.prepare("SELECT COUNT(*) AS n FROM oauth_states").get().n, 1);
  assert.match((await handleApi(callback(state, state), env)).headers.get("location"), /auth=cancelled/);
  assert.match((await handleApi(callback(state, state), env)).headers.get("location"), /auth=failed/);
  assert.equal(env.DB.db.prepare("SELECT COUNT(*) AS n FROM oauth_states").get().n, 0);
  const secondStart = await handleApi(new Request(`${ORIGIN}/api/auth/google/start`), env);
  const secondState = new URL(secondStart.headers.get("location")).searchParams.get("state");
  env.DB.db.prepare("UPDATE oauth_states SET expires_at = 0").run();
  assert.match((await handleApi(callback(secondState, secondState), env)).headers.get("location"), /auth=failed/);
  assert.equal(env.DB.db.prepare("SELECT COUNT(*) AS n FROM oauth_states").get().n, 0);
  env.DB.db.close();
});

test("configured OAuth rate limiter rejects before writing D1 and uses a non-IP key", async () => {
  const env = await fixture();
  let key;
  env.AUTH_RATE_LIMITER = { limit: async (input) => { key = input.key; return { success: false }; } };
  const response = await handleApi(new Request(`${ORIGIN}/api/auth/google/start`, { headers: { "CF-Connecting-IP": "192.0.2.1" } }), env);
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("retry-after"), "60");
  assert.ok(key && !key.includes("192.0.2.1"));
  assert.equal(env.DB.db.prepare("SELECT COUNT(*) AS n FROM oauth_states").get().n, 0);
  env.DB.db.close();
});

test("cookie/origin/return URL security rejects duplicate cookies and external redirects", () => {
  assert.equal(configuredOrigin("https://app.example/path"), null);
  assert.equal(configuredOrigin("http://public.example"), null);
  assert.equal(configuredOrigin("http://127.0.0.1:8788"), "http://127.0.0.1:8788");
  assert.equal(safeReturnTo("//attacker.example"), "/lumina/");
  assert.equal(safeReturnTo("/lumina/?view=equipment"), "/lumina/?view=equipment");
  assert.equal(cookieValue(new Request(ORIGIN, { headers: { Cookie: `lumina_session=${TOKEN_A}; lumina_session=${TOKEN_B}` } }), "lumina_session"), null);
  assert.match(cookie("lumina_session", TOKEN_A, ORIGIN, 100), /HttpOnly; SameSite=Lax; Max-Age=100; Secure/);
});

test("Google ID tokens verify signature issuer audience expiry nonce and authorized party", async () => {
  const { privateKey, publicKey } = await generateKeyPair("RS256", { extractable: true });
  const jwk = await exportJWK(publicKey);
  jwk.kid = "test-key";
  const key = createLocalJWKSet({ keys: [jwk] });
  const sign = async (changes = {}) => new SignJWT({ sub: "google-id", iss: "https://accounts.google.com", aud: "client", iat: now(), exp: now() + 300, nonce: "nonce-value", name: "旅人", picture: "https://lh3.googleusercontent.com/avatar", ...changes }).setProtectedHeader({ alg: "RS256", kid: "test-key" }).sign(privateKey);
  assert.deepEqual(await validateGoogleToken(await sign(), "client", "nonce-value", key), { sub: "google-id", name: "旅人", picture: "https://lh3.googleusercontent.com/avatar" });
  for (const changes of [{ iss: "https://attacker.example" }, { aud: "other-client" }, { exp: now() - 1 }, { nonce: "wrong" }, { azp: "other-client" }, { aud: ["client", "other"] }]) {
    await assert.rejects(validateGoogleToken(await sign(changes), "client", "nonce-value", key));
  }
  const { privateKey: otherKey } = await generateKeyPair("RS256");
  const forged = await new SignJWT({ sub: "forged", nonce: "nonce-value" }).setProtectedHeader({ alg: "RS256", kid: "test-key" }).setIssuer("https://accounts.google.com").setAudience("client").setIssuedAt().setExpirationTime("5m").sign(otherKey);
  await assert.rejects(validateGoogleToken(forged, "client", "nonce-value", key));
  const unsafeImage = await validateGoogleToken(await sign({ picture: "https://attacker.example/image" }), "client", "nonce-value", key);
  assert.equal(unsafeImage.picture, null);
});

test("OAuth callback completes only with validated token and rotates the browser session (mock Google, real SQL)", async () => {
  const env = await fixture();
  const { privateKey, publicKey } = await generateKeyPair("RS256", { extractable: true });
  const jwk = { ...await exportJWK(publicKey), alg: "RS256", use: "sig", kid: "callback-test-key" };
  const start = await handleApi(new Request(`${ORIGIN}/api/auth/google/start?returnTo=${encodeURIComponent("/lumina/?view=equipment")}`), env);
  const auth = new URL(start.headers.get("location"));
  const state = auth.searchParams.get("state");
  const flow = env.DB.db.prepare("SELECT * FROM oauth_states").get();
  const idToken = await new SignJWT({ sub: "new-google-subject", nonce: flow.nonce, name: "テスト旅人" }).setProtectedHeader({ alg: "RS256", kid: "callback-test-key" }).setIssuer("https://accounts.google.com").setAudience(env.GOOGLE_CLIENT_ID).setIssuedAt().setExpirationTime("5m").sign(privateKey);
  const originalFetch = globalThis.fetch;
  let exchangeCount = 0;
  globalThis.fetch = async (input, options) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url === "https://oauth2.googleapis.com/token") {
      exchangeCount += 1;
      assert.equal(options.body.get("code_verifier"), flow.verifier);
      assert.equal(options.body.get("client_secret"), env.GOOGLE_CLIENT_SECRET);
      assert.equal(options.body.get("redirect_uri"), `${ORIGIN}/api/auth/google/callback`);
      return Response.json({ id_token: idToken });
    }
    if (url === "https://www.googleapis.com/oauth2/v3/certs") return Response.json({ keys: [jwk] });
    throw new Error("Unexpected external request in test");
  };
  try {
    const callback = new Request(`${ORIGIN}/api/auth/google/callback?state=${state}&code=test-code`, { headers: { Cookie: `lumina_oauth=${state}; lumina_session=${TOKEN_A}` } });
    const response = await handleApi(callback, env);
    assert.equal(response.status, 302);
    assert.equal(response.headers.get("location"), `${ORIGIN}/lumina/?view=equipment`);
    const newSessionCookie = response.headers.getSetCookie().find(value => value.startsWith("lumina_session="));
    assert.match(newSessionCookie, /HttpOnly.*Secure/);
    const token = newSessionCookie.match(/^lumina_session=([^;]+)/)[1];
    assert.notEqual(token, TOKEN_A);
    assert.equal(env.DB.db.prepare("SELECT COUNT(*) AS n FROM sessions WHERE token_hash = ?").get(await hashToken(TOKEN_A)).n, 0);
    const stored = env.DB.db.prepare("SELECT token_hash FROM sessions WHERE token_hash = ?").get(await hashToken(token));
    assert.ok(stored);
    assert.notEqual(stored.token_hash, token);
    const session = await (await handleApi(await authenticated("/api/auth/session", "GET", token), env)).json();
    assert.equal(session.authenticated, true);
    assert.equal(session.user.name, "テスト旅人");
    assert.equal((await handleApi(callback, env)).headers.get("location"), `${ORIGIN}/lumina/?auth=failed`);
    assert.equal(exchangeCount, 1);
  } finally {
    globalThis.fetch = originalFetch;
    env.DB.db.close();
  }
});

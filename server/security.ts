import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

export const SESSION_COOKIE = "lumina_session";
export const OAUTH_COOKIE = "lumina_oauth";
export const SESSION_TTL = 14 * 24 * 60 * 60;
export const OAUTH_TTL = 10 * 60;
const googleKeys = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

export function randomToken(): string {
  return base64url(crypto.getRandomValues(new Uint8Array(32)));
}

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

export async function hashToken(token: string): Promise<string> {
  return base64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))));
}

export function equalToken(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

export function cookieValue(request: Request, name: string): string | null {
  const prefix = `${name}=`;
  const matches = (request.headers.get("Cookie") ?? "").split(";").map(part => part.trim()).filter(part => part.startsWith(prefix));
  // Reject ambiguous duplicate cookies rather than choosing an attacker-controlled path cookie.
  if (matches.length !== 1) return null;
  const value = matches[0].slice(prefix.length);
  return /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null;
}

export function configuredOrigin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if ((url.protocol !== "https:" && !(local && url.protocol === "http:")) || url.username || url.password || url.search || url.hash || url.pathname !== "/") return null;
    return url.origin;
  } catch { return null; }
}

export function cookie(name: string, value: string, origin: string, maxAge: number): string {
  const secure = new URL(origin).protocol === "https:" ? "; Secure" : "";
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function sameOrigin(request: Request, origin: string): boolean {
  return new URL(request.url).origin === origin && request.headers.get("Origin") === origin && request.headers.get("Sec-Fetch-Site") !== "cross-site";
}

export function safeReturnTo(input: string | null): string {
  if (!input || input.length > 200 || !/^\/lumina\/(?:\?[^#]*)?$/.test(input) || /[\\\r\n]/.test(input)) return "/lumina/";
  return input;
}

export async function csrfToken(sessionToken: string): Promise<string> {
  return hashToken(`lumina-csrf:${sessionToken}`);
}

export async function validateGoogleToken(token: string, clientId: string, nonce: string, key: JWTVerifyGetKey = googleKeys) {
  const { payload } = await jwtVerify(token, key, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: clientId,
    algorithms: ["RS256"],
    maxTokenAge: "1h",
    requiredClaims: ["sub", "iat", "exp", "nonce"],
  });
  if (typeof payload.sub !== "string" || !payload.sub || payload.sub.length > 255 || typeof payload.nonce !== "string" || !equalToken(payload.nonce, nonce)) throw new Error("Invalid Google identity");
  if ((Array.isArray(payload.aud) && payload.aud.length > 1 && payload.azp !== clientId) || (payload.azp !== undefined && payload.azp !== clientId)) throw new Error("Invalid authorized party");
  const name = typeof payload.name === "string" ? payload.name.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 80) : "旅人";
  let picture: string | null = null;
  if (typeof payload.picture === "string" && payload.picture.length < 2048) {
    try {
      const url = new URL(payload.picture);
      if (url.protocol === "https:" && !url.username && !url.password && (url.hostname === "googleusercontent.com" || url.hostname.endsWith(".googleusercontent.com"))) picture = url.href;
    } catch { /* An optional image must not affect identity verification. */ }
  }
  return { sub: payload.sub, name: name || "旅人", picture };
}

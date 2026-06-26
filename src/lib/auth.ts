import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

// ── Config ─────────────────────────────────────────────────────────────────
// Secrets are read from process.env at RUNTIME only. We must not touch
// import.meta.env here: Vite inlines it at build time, which both freezes
// build-time values (ignoring the host's runtime vars) and bakes secrets into
// the bundle. In production the host (e.g. Railway) injects real env vars into
// process.env. For local `astro dev`, we load `.env` into process.env ourselves
// — guarded by import.meta.env.DEV (a static boolean Vite replaces with
// false in prod, so this branch is dead-code-eliminated and inlines nothing).
if (import.meta.env.DEV) {
  try {
    (process as any).loadEnvFile?.('.env'); // Node >= 20.12 / 22.12
  } catch {
    /* missing .env in dev is fine */
  }
}

function env(key: string): string | undefined {
  const v = process.env[key];
  return v != null && v !== '' ? v : undefined;
}

export interface AuthConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  sessionSecret: string;
}

let cachedConfig: AuthConfig | null = null;

/** Throws a clear error if any required Azure/session env var is missing. */
export function getAuthConfig(): AuthConfig {
  if (cachedConfig) return cachedConfig;
  const tenantId      = env('AZURE_TENANT_ID');
  const clientId      = env('AZURE_CLIENT_ID');
  const clientSecret  = env('AZURE_CLIENT_SECRET');
  const redirectUri   = env('AZURE_REDIRECT_URI');
  const sessionSecret = env('SESSION_SECRET');

  const missing = Object.entries({
    AZURE_TENANT_ID: tenantId,
    AZURE_CLIENT_ID: clientId,
    AZURE_CLIENT_SECRET: clientSecret,
    AZURE_REDIRECT_URI: redirectUri,
    SESSION_SECRET: sessionSecret,
  }).filter(([, v]) => !v).map(([k]) => k);

  if (missing.length) {
    throw new Error(`[auth] Missing required env var(s): ${missing.join(', ')}. See .env.example.`);
  }

  cachedConfig = {
    tenantId: tenantId!,
    clientId: clientId!,
    clientSecret: clientSecret!,
    redirectUri: redirectUri!,
    sessionSecret: sessionSecret!,
  };
  return cachedConfig;
}

// ── base64url helpers ────────────────────────────────────────────────────────
function b64urlEncode(buf: Buffer | string): string {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(str: string): Buffer {
  return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

// ── Generic signed token (used for both the session and the oauth_tx cookie) ──
function hmac(data: string): string {
  return b64urlEncode(createHmac('sha256', getAuthConfig().sessionSecret).update(data).digest());
}

/** Sign an arbitrary JSON-serialisable object → `body.signature`. */
export function sign(obj: Record<string, unknown>): string {
  const body = b64urlEncode(JSON.stringify({ ...obj, iat: obj.iat ?? Math.floor(Date.now() / 1000) }));
  return `${body}.${hmac(body)}`;
}

/** Verify a `body.signature` string; returns the parsed object or null. */
export function verify<T = any>(value: string | null | undefined, maxAgeSec?: number): T | null {
  if (!value || !value.includes('.')) return null;
  const [body, sig] = value.split('.', 2);
  let expected: string;
  try {
    expected = hmac(body);
  } catch {
    return null; // config not available
  }
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  let payload: any;
  try {
    payload = JSON.parse(b64urlDecode(body).toString('utf8'));
  } catch {
    return null;
  }
  if (maxAgeSec != null && typeof payload.iat === 'number') {
    if (Math.floor(Date.now() / 1000) - payload.iat > maxAgeSec) return null;
  }
  return payload as T;
}

// ── Session ──────────────────────────────────────────────────────────────────
export interface SessionData {
  uid: string;   // Entra object id (oid) — stable per user within the tenant
  name: string;  // Entra display name
  email?: string;
  iat?: number;
}

export const SESSION_TTL = 7 * 24 * 60 * 60; // 7 days
const SESSION_COOKIE = 'choc_session';
const TX_COOKIE      = 'oauth_tx';
const TX_TTL         = 600; // 10 minutes for the auth round-trip

function readCookie(request: Request, name: string): string | null {
  const cookie = request.headers.get('cookie') ?? '';
  const match  = cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/** Parse + verify the session cookie. Returns null if absent/invalid/expired. */
export function getSession(request: Request): SessionData | null {
  return verify<SessionData>(readCookie(request, SESSION_COOKIE), SESSION_TTL);
}

/** Stable per-user player token derived from the Entra object id. */
export function derivePlayerToken(uid: string): string {
  return createHmac('sha256', getAuthConfig().sessionSecret).update(`pt:${uid}`).digest('hex');
}

// ── Cookie builders ───────────────────────────────────────────────────────────
function secureFlag(): string {
  return getAuthConfig().redirectUri.startsWith('https') ? '; Secure' : '';
}

export function sessionCookie(data: SessionData): string {
  const value = encodeURIComponent(sign({ uid: data.uid, name: data.name, email: data.email }));
  return `${SESSION_COOKIE}=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL}${secureFlag()}`;
}
export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secureFlag()}`;
}

export interface TxData { state: string; nonce: string; verifier: string; return_to?: string; iat?: number; }
export function txCookie(data: TxData): string {
  const value = encodeURIComponent(sign({ ...data }));
  return `${TX_COOKIE}=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${TX_TTL}${secureFlag()}`;
}
export function clearTxCookie(): string {
  return `${TX_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secureFlag()}`;
}
export function getTx(request: Request): TxData | null {
  return verify<TxData>(readCookie(request, TX_COOKIE), TX_TTL);
}

export function randomString(bytes = 16): string {
  return randomBytes(bytes).toString('hex');
}

/** Generate a PKCE verifier + S256 challenge pair. */
export function generatePkce(): { verifier: string; challenge: string } {
  const verifier = b64urlEncode(randomBytes(32));
  const challenge = b64urlEncode(createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

// ── OAuth2 (Entra v2.0 endpoints) ─────────────────────────────────────────────
const SCOPES = 'openid profile email';

export function buildAuthorizeUrl(opts: { state: string; nonce: string; codeChallenge: string }): string {
  const { tenantId, clientId, redirectUri } = getAuthConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    response_mode: 'query',
    scope: SCOPES,
    state: opts.state,
    nonce: opts.nonce,
    code_challenge: opts.codeChallenge,
    code_challenge_method: 'S256',
  });
  return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${params.toString()}`;
}

/** Exchange an authorization code (+ PKCE verifier) for tokens at the token endpoint. */
export async function exchangeCode(code: string, codeVerifier: string): Promise<{ id_token?: string; error?: string; error_description?: string }> {
  const { tenantId, clientId, clientSecret, redirectUri } = getAuthConfig();
  const body = new URLSearchParams({
    client_id: clientId,
    scope: SCOPES,
    code,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
    client_secret: clientSecret,
    code_verifier: codeVerifier,
  });
  const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  return res.json();
}

export interface IdTokenClaims {
  oid?: string; sub?: string; name?: string; preferred_username?: string;
  email?: string; tid?: string; nonce?: string;
}

/**
 * Decode the id_token payload. We trust it without JWKS signature verification
 * because it was just returned to us directly from the Entra token endpoint over
 * TLS in response to our authenticated (client_secret) request — the standard
 * trust model for a confidential server-side web app.
 */
export function decodeIdToken(jwt: string): IdTokenClaims | null {
  const parts = jwt.split('.');
  if (parts.length < 2) return null;
  try {
    return JSON.parse(b64urlDecode(parts[1]).toString('utf8'));
  } catch {
    return null;
  }
}

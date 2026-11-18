// Who may use /admin. A single shared password in ADMIN_PASSWORD, traded for a
// cookie that is an HMAC of that password: stateless, and changing the password
// signs everyone out.
//
//   ADMIN_PASSWORD set     login required, in dev and in production
//   not set, in dev        open, so local work needs no setup
//   not set, production    the dashboard is off (404): never open by accident

import { createHmac, timingSafeEqual } from 'node:crypto';

const PASSWORD = process.env.ADMIN_PASSWORD ?? '';
const COOKIE = 'admin_session';
const WEEK = 7 * 24 * 3600;

/** Does /admin exist at all on this server? */
export function adminAvailable(): boolean {
  return !!PASSWORD || import.meta.env.DEV;
}

/** Open to anyone who can reach it (dev without a password). */
export function adminOpen(): boolean {
  return !PASSWORD && import.meta.env.DEV;
}

function sessionValue(): string {
  return createHmac('sha256', PASSWORD).update('chocolottery-admin-session').digest('hex');
}

function same(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function checkPassword(input: unknown): boolean {
  return !!PASSWORD && typeof input === 'string' && same(
    createHmac('sha256', 'pw').update(input).digest('hex'),
    createHmac('sha256', 'pw').update(PASSWORD).digest('hex'),
  );
}

function cookieFrom(request: Request): string | null {
  const m = (request.headers.get('cookie') ?? '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}

export function isAdmin(request: Request): boolean {
  if (!adminAvailable()) return false;
  if (adminOpen()) return true;
  const c = cookieFrom(request);
  return !!c && same(c, sessionValue());
}

const secure = (request: Request) =>
  new URL(request.url).protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https';

export function sessionCookie(request: Request): string {
  return `${COOKIE}=${sessionValue()}; Path=/; Max-Age=${WEEK}; HttpOnly; SameSite=Strict${secure(request) ? '; Secure' : ''}`;
}

export function clearCookie(request: Request): string {
  return `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict${secure(request) ? '; Secure' : ''}`;
}

// Slow down guessing: after a handful of misses everyone waits a minute.
let misses: number[] = [];
export function loginLocked(): boolean {
  const now = Date.now();
  misses = misses.filter((t) => now - t < 10 * 60_000);
  return misses.length >= 5 && now - misses[misses.length - 1] < 60_000;
}
export function noteMiss(): void {
  misses.push(Date.now());
}
export function clearMisses(): void {
  misses = [];
}

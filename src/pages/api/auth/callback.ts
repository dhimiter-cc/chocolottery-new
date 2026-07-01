import type { APIRoute } from 'astro';
import {
  getAuthConfig, getTx, exchangeCode, decodeIdToken,
  sessionCookie, clearTxCookie,
} from '../../../lib/auth.js';

function fail(reason: string): Response {
  const headers = new Headers({ Location: '/login?error=' + encodeURIComponent(reason) });
  headers.append('Set-Cookie', clearTxCookie());
  return new Response(null, { status: 302, headers });
}

export const GET: APIRoute = async ({ request, url }) => {
  const err = url.searchParams.get('error');
  if (err) return fail(url.searchParams.get('error_description') ?? err);

  const code  = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state) return fail('Missing code or state');

  // Validate state against the signed transaction cookie (CSRF protection).
  const tx = getTx(request);
  if (!tx || tx.state !== state) return fail('Invalid state');

  // Exchange the authorization code (+ PKCE verifier) for tokens.
  const tokens = await exchangeCode(code, tx.verifier);
  if (!tokens.id_token) return fail(tokens.error_description ?? tokens.error ?? 'Token exchange failed');

  const claims = decodeIdToken(tokens.id_token);
  if (!claims) return fail('Could not read identity token');

  // Verify nonce and single-tenant constraint.
  if (claims.nonce !== tx.nonce) return fail('Nonce mismatch');
  if (claims.tid !== getAuthConfig().tenantId) return fail('Sign-in is restricted to this organization');

  const uid = claims.oid ?? claims.sub;
  if (!uid) return fail('Identity token missing subject');

  // Prefer the discrete given_name/family_name claims over `name`. This
  // tenant's `name` claim is formatted as "First Last | CompanyName" —
  // split on the `|` and keep only the name portion.
  const rawName = claims.given_name && claims.family_name
    ? `${claims.given_name} ${claims.family_name}`
    : claims.name ?? claims.preferred_username ?? 'Player';
  const name = rawName.split('|')[0].trim().slice(0, 60);
  const email = claims.email ?? claims.preferred_username;

  const headers = new Headers({ Location: tx.return_to || '/' });
  headers.append('Set-Cookie', sessionCookie({ uid, name, email }));
  headers.append('Set-Cookie', clearTxCookie());
  return new Response(null, { status: 302, headers });
};

import type { APIRoute } from 'astro';
import { buildAuthorizeUrl, generatePkce, randomString, txCookie } from '../../../lib/auth.js';

export const GET: APIRoute = async ({ url }) => {
  try {
    const state = randomString();
    const nonce = randomString();
    const { verifier, challenge } = generatePkce();
    const returnTo = url.searchParams.get('return_to') ?? '/';

    const authorizeUrl = buildAuthorizeUrl({ state, nonce, codeChallenge: challenge });

    const headers = new Headers({ Location: authorizeUrl });
    headers.append('Set-Cookie', txCookie({ state, nonce, verifier, return_to: returnTo }));
    return new Response(null, { status: 302, headers });
  } catch (err) {
    // Surface configuration problems (e.g. missing env vars) instead of an
    // opaque 500 — the message names the missing vars and contains no secrets.
    console.error('[api/auth/login]', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Auth misconfigured' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

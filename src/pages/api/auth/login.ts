import type { APIRoute } from 'astro';
import { buildAuthorizeUrl, generatePkce, randomString, txCookie } from '../../../lib/auth.js';

export const GET: APIRoute = async ({ url }) => {
  const state = randomString();
  const nonce = randomString();
  const { verifier, challenge } = generatePkce();
  const returnTo = url.searchParams.get('return_to') ?? '/';

  const authorizeUrl = buildAuthorizeUrl({ state, nonce, codeChallenge: challenge });

  const headers = new Headers({ Location: authorizeUrl });
  headers.append('Set-Cookie', txCookie({ state, nonce, verifier, return_to: returnTo }));
  return new Response(null, { status: 302, headers });
};

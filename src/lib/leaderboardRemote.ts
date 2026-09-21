// ── Durable off-host mirror of the leaderboard ────────────────────────────────
//
// Every JSON file this app writes lives on the host's container disk, and that
// disk is not ours: when the Railway deployment was removed, the whole win
// history went with it. So the leaderboard now has a second home outside the
// host — a JSON file committed to a GitHub repo through the Contents API.
//
//   GitHub                = the durable copy (survives the host being deleted)
//   data/leaderboard.json = a fast local read cache, rebuilt from GitHub on boot
//
// ⚠️  GITHUB_DATA_BRANCH must be a branch Railway does NOT deploy from
//     (default: chocolottery-data). Committing to the deploy branch would
//     redeploy — and therefore restart — the server every time somebody loses.
//
// Everything here is failure-tolerant on purpose: if the token is missing,
// GitHub is down, or we get rate-limited, the game keeps running on local files
// and the only casualty is the off-host backup of that one win.

import type { LeaderboardWin } from './types.js';

const TIMEOUT = 10_000;
const UA      = 'chocolate-lottery';

// Overridable so the mirror can be pointed at a stub in tests.
const API = process.env.GITHUB_API_BASE ?? 'https://api.github.com';

const TOKEN  = process.env.GITHUB_TOKEN ?? '';
const REPO   = process.env.GITHUB_REPO ?? '';
const BRANCH = process.env.GITHUB_DATA_BRANCH ?? 'chocolottery-data';
const FILE   = process.env.GITHUB_DATA_PATH ?? 'leaderboard.json';

// Blob SHA of the file as we last saw it. The Contents API requires it to
// update an existing file; refreshed whenever GitHub tells us it's stale.
let knownSha: string | null = null;
let branchReady = false;

export function remoteEnabled(): boolean {
  return !!(TOKEN && REPO);
}

export function remoteTarget(): string {
  return `${REPO}@${BRANCH}:${FILE}`;
}

async function gh(
  method: string,
  endpoint: string,
  body?: unknown
): Promise<{ ok: boolean; status: number; data: any }> {
  const res = await fetch(API + endpoint, {
    method,
    headers: {
      Authorization:          `Bearer ${TOKEN}`,
      Accept:                 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent':           UA,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body:   body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(TIMEOUT),
  });

  const data = res.status === 204 ? null : await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
}

// Create the data branch on first use, so setup is nothing more than adding a
// couple of env vars. Branches off the repo's default branch HEAD.
async function ensureBranch(): Promise<boolean> {
  if (branchReady) return true;

  const existing = await gh('GET', `/repos/${REPO}/git/ref/heads/${BRANCH}`);
  if (existing.ok) { branchReady = true; return true; }
  if (existing.status !== 404) {
    console.error(`[leaderboard] cannot read branch ${BRANCH}:`, existing.status, existing.data?.message);
    return false;
  }

  const repo = await gh('GET', `/repos/${REPO}`);
  if (!repo.ok) {
    console.error('[leaderboard] cannot read repo:', repo.status, repo.data?.message);
    return false;
  }
  const base = await gh('GET', `/repos/${REPO}/git/ref/heads/${repo.data.default_branch}`);
  if (!base.ok) {
    console.error('[leaderboard] cannot read default branch:', base.status, base.data?.message);
    return false;
  }

  const created = await gh('POST', `/repos/${REPO}/git/refs`, {
    ref: `refs/heads/${BRANCH}`,
    sha: base.data.object.sha,
  });
  // 422 = another instance created it a moment ago. Either way it exists now.
  if (!created.ok && created.status !== 422) {
    console.error(`[leaderboard] cannot create branch ${BRANCH}:`, created.status, created.data?.message);
    return false;
  }

  console.log(`[leaderboard] data branch ${BRANCH} ready`);
  branchReady = true;
  return true;
}

// Fetch the durable copy. `null` means "couldn't reach it" — leave local data
// alone. An empty array means "reached it, nothing stored there yet".
export async function pullRemoteWins(): Promise<LeaderboardWin[] | null> {
  if (!remoteEnabled()) return null;

  try {
    const path = `/repos/${REPO}/contents/${encodeURIComponent(FILE)}?ref=${encodeURIComponent(BRANCH)}`;
    const res  = await gh('GET', path);

    if (res.status === 404) { knownSha = null; return []; }
    if (!res.ok) {
      console.error('[leaderboard] pull failed:', res.status, res.data?.message);
      return null;
    }

    knownSha = res.data.sha ?? null;
    const json = Buffer.from(res.data.content ?? '', 'base64').toString('utf8');
    const wins = JSON.parse(json)?.wins;
    return Array.isArray(wins) ? wins : [];
  } catch (err) {
    console.error('[leaderboard] pull error:', err instanceof Error ? err.message : err);
    return null;
  }
}

// Commit the full win list. Retries once with a fresh SHA, which is what a
// concurrent write from another instance looks like.
export async function pushRemoteWins(wins: LeaderboardWin[]): Promise<boolean> {
  if (!remoteEnabled()) return false;

  try {
    if (!(await ensureBranch())) return false;

    const content = Buffer.from(JSON.stringify({ wins }, null, 2) + '\n', 'utf8').toString('base64');
    const latest  = wins[wins.length - 1];
    const message = latest
      ? `🍫 ${latest.name} wins chocolate (${latest.game_code}) — ${wins.length} total`
      : `chocolottery: leaderboard sync — ${wins.length} wins`;

    for (let attempt = 0; attempt < 2; attempt++) {
      if (knownSha === null && attempt === 0) await pullRemoteWins();

      const res = await gh('PUT', `/repos/${REPO}/contents/${encodeURIComponent(FILE)}`, {
        message,
        content,
        branch: BRANCH,
        ...(knownSha ? { sha: knownSha } : {}),
      });

      if (res.ok) {
        knownSha = res.data?.content?.sha ?? null;
        return true;
      }

      // 409/422 = our SHA is stale. Re-read it and try once more.
      if (res.status === 409 || res.status === 422) {
        await pullRemoteWins();
        continue;
      }

      console.error('[leaderboard] push failed:', res.status, res.data?.message);
      return false;
    }

    console.error('[leaderboard] push failed after retry (stale sha)');
    return false;
  } catch (err) {
    // Network down, DNS, timeout. The local write already happened, so the
    // round itself is safe — we've only lost the off-host copy of this win.
    console.error('[leaderboard] push error:', err instanceof Error ? err.message : err);
    return false;
  }
}

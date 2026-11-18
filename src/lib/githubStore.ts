// A single JSON file kept on a GitHub branch through the Contents API: the
// durable home for data that must outlive the host's disposable disk. The
// leaderboard has its own, older copy of this (leaderboardRemote.ts); the admin
// settings use this one.
//
// ⚠️  The branch must NOT be the one the host deploys from: every save is a
//     commit, and a commit to the deploy branch would restart the server.
//
// Failure-tolerant on purpose: no token, GitHub down, rate-limited — callers get
// a result saying so and the app keeps running on its local copy.

const TIMEOUT = 10_000;
const API = process.env.GITHUB_API_BASE ?? 'https://api.github.com';
const TOKEN = process.env.GITHUB_TOKEN ?? '';
const REPO = process.env.GITHUB_REPO ?? '';

export type PullResult<T> = { reachable: true; found: boolean; value: T | null } | { reachable: false };
export type PushResult = 'saved' | 'not-configured' | 'failed';

export interface RemoteJson<T> {
  enabled(): boolean;
  /** `owner/repo@branch:path`, for display. */
  target(): string;
  /** Link to the file's history on GitHub, for the admin page. */
  historyUrl(): string;
  pull(): Promise<PullResult<T>>;
  push(value: T, message: string): Promise<PushResult>;
}

async function gh(method: string, endpoint: string, body?: unknown): Promise<{ ok: boolean; status: number; data: any }> {
  const res = await fetch(API + endpoint, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'chocolottery',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(TIMEOUT),
  });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
}

export function remoteJson<T>(opts: { branch: string; path: string; label: string }): RemoteJson<T> {
  const { branch, path, label } = opts;
  let knownSha: string | null = null;
  let branchReady = false;
  // The Contents API rejects concurrent writes to one file: serialise them.
  let queue: Promise<unknown> = Promise.resolve();

  const enabled = () => !!(TOKEN && REPO);
  const contentsPath = () => `/repos/${REPO}/contents/${path.split('/').map(encodeURIComponent).join('/')}`;

  async function ensureBranch(): Promise<boolean> {
    if (branchReady) return true;
    const existing = await gh('GET', `/repos/${REPO}/git/ref/heads/${branch}`);
    if (existing.ok) { branchReady = true; return true; }
    if (existing.status !== 404) {
      console.error(`[${label}] cannot read branch ${branch}:`, existing.status, existing.data?.message);
      return false;
    }
    const repo = await gh('GET', `/repos/${REPO}`);
    if (!repo.ok) { console.error(`[${label}] cannot read repo:`, repo.status, repo.data?.message); return false; }
    const base = await gh('GET', `/repos/${REPO}/git/ref/heads/${repo.data.default_branch}`);
    if (!base.ok) { console.error(`[${label}] cannot read default branch:`, base.status, base.data?.message); return false; }
    const created = await gh('POST', `/repos/${REPO}/git/refs`, { ref: `refs/heads/${branch}`, sha: base.data.object.sha });
    // 422 = another instance created it a moment ago. Either way it exists now.
    if (!created.ok && created.status !== 422) {
      console.error(`[${label}] cannot create branch ${branch}:`, created.status, created.data?.message);
      return false;
    }
    console.log(`[${label}] branch ${branch} ready`);
    branchReady = true;
    return true;
  }

  async function pull(): Promise<PullResult<T>> {
    if (!enabled()) return { reachable: false };
    try {
      const res = await gh('GET', `${contentsPath()}?ref=${encodeURIComponent(branch)}`);
      if (res.status === 404) { knownSha = null; return { reachable: true, found: false, value: null }; }
      if (!res.ok) { console.error(`[${label}] pull failed:`, res.status, res.data?.message); return { reachable: false }; }
      knownSha = res.data.sha ?? null;
      const value = JSON.parse(Buffer.from(res.data.content ?? '', 'base64').toString('utf8')) as T;
      return { reachable: true, found: true, value };
    } catch (err) {
      console.error(`[${label}] pull error:`, err instanceof Error ? err.message : err);
      return { reachable: false };
    }
  }

  async function pushOnce(value: T, message: string): Promise<PushResult> {
    if (!enabled()) return 'not-configured';
    try {
      if (!(await ensureBranch())) return 'failed';
      const content = Buffer.from(JSON.stringify(value, null, 2) + '\n', 'utf8').toString('base64');
      for (let attempt = 0; attempt < 2; attempt++) {
        if (knownSha === null && attempt === 0) await pull();
        const res = await gh('PUT', contentsPath(), { message, content, branch, ...(knownSha ? { sha: knownSha } : {}) });
        if (res.ok) { knownSha = res.data?.content?.sha ?? null; return 'saved'; }
        // 409/422 = our SHA is stale. Re-read it and try once more.
        if (res.status === 409 || res.status === 422) { await pull(); continue; }
        console.error(`[${label}] push failed:`, res.status, res.data?.message);
        return 'failed';
      }
      console.error(`[${label}] push failed after retry (stale sha)`);
      return 'failed';
    } catch (err) {
      console.error(`[${label}] push error:`, err instanceof Error ? err.message : err);
      return 'failed';
    }
  }

  function push(value: T, message: string): Promise<PushResult> {
    const run = queue.then(() => pushOnce(value, message));
    queue = run.catch(() => undefined);
    return run;
  }

  return {
    enabled,
    target: () => `${REPO}@${branch}:${path}`,
    historyUrl: () => `https://github.com/${REPO}/commits/${encodeURIComponent(branch)}/${path}`,
    pull,
    push,
  };
}

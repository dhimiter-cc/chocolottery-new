// Tiny typed client for the JSON POST endpoints. Centralises the
// method/headers/JSON.stringify boilerplate that every action used to repeat.
//
// Resolves with { ok, status, data } so callers can branch on either the HTTP
// status (res.ok) or the API's { error } convention. Only rejects on a genuine
// network error — wrap calls in try/catch the same way the old fetch code did.

export interface ApiResult<T = any> {
  ok: boolean;
  status: number;
  data: T;
}

export async function post<T = any>(url: string, body: unknown): Promise<ApiResult<T>> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  let data: any = {};
  try { data = await res.json(); } catch {}
  return { ok: res.ok, status: res.status, data };
}

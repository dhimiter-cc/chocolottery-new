<script lang="ts">
  // The admin dashboard: every setting that used to live in code or env vars.
  // Edits stay in a draft until Save; saving writes the server's copy and
  // commits it to the settings branch on GitHub (lib/settings.ts), so the git
  // history is the log of who changed what. Themes are shown with a live
  // thumbnail of the real landing page plus what each one changes.
  import { DEFAULT_THEME, EVENTS, getTheme, windowOf, type Theme } from '../themes/index.js';
  import { playPackSample } from '../lib/sound.js';
  import type { Settings, SyncStatus, AdventPrize } from '../lib/settings.js';
  import type { AdventView } from '../lib/advent.js';

  interface View { settings: Settings; sync: SyncStatus; activeTheme: string; advent: AdventView }

  let { initial, open = false }: { initial: View | null; open?: boolean } = $props();

  const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

  // ── Sign in ───────────────────────────────────────────────────────────────
  let view = $state<View | null>(initial ? clone(initial) : null);
  let draft = $state<Settings | null>(initial ? clone(initial.settings) : null);
  let password = $state('');
  let loginError = $state('');
  let busy = $state(false);

  async function load(): Promise<boolean> {
    const res = await fetch('/api/admin/settings');
    if (!res.ok) return false;
    view = await res.json();
    draft = clone(view!.settings);
    return true;
  }

  async function login(e: SubmitEvent) {
    e.preventDefault();
    busy = true;
    loginError = '';
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) loginError = data.error ?? 'Could not sign in.';
      else { password = ''; await load(); }
    } catch { loginError = 'Network error.'; }
    finally { busy = false; }
  }

  async function logout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    view = null;
    draft = null;
  }

  // ── Saving ────────────────────────────────────────────────────────────────
  // Empty door rows are only there to bind inputs to; they are not a change.
  const filled = (prizes: Record<string, AdventPrize>) =>
    Object.fromEntries(Object.entries(prizes).filter(([, p]) => p.title.trim() || p.svg));
  const strip = (s: Settings) =>
    JSON.stringify({ ...s, advent: { ...s.advent, prizes: filled(s.advent.prizes) }, updated_at: 0, updated_by: '' });
  let dirty = $derived(!!(draft && view && strip(draft) !== strip(view.settings)));
  let note = $state<{ kind: 'ok' | 'warn' | 'bad'; text: string } | null>(null);

  async function save() {
    if (!draft) return;
    busy = true;
    note = null;
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      if (res.status === 401) { view = null; draft = null; return; }
      const data = await res.json();
      view = data;
      draft = clone(data.settings);
      if (!data.changed?.length) note = { kind: 'ok', text: 'Nothing to save.' };
      else if (data.remote === 'saved') note = { kind: 'ok', text: `Saved and committed to ${data.sync.target.split(':')[0]}.` };
      else if (data.remote === 'not-configured') note = { kind: 'warn', text: 'Saved on this server only. GitHub is not set up here (GITHUB_TOKEN and GITHUB_REPO), so there is no commit.' };
      else note = { kind: 'bad', text: 'Saved on this server, but the commit to GitHub failed. It will be retried on the next save.' };
    } catch { note = { kind: 'bad', text: 'Network error. Nothing was saved.' }; }
    finally { busy = false; }
  }

  function discard() {
    if (view) draft = clone(view.settings);
    note = null;
  }

  // ── Themes ────────────────────────────────────────────────────────────────
  interface Card { id: string; label: string; theme: Theme; builtIn: { from: string; to: string } | null; isDefault: boolean }
  const cards: Card[] = [
    { id: 'default', label: 'Default', theme: DEFAULT_THEME, builtIn: null, isDefault: true },
    ...EVENTS.map((e) => ({ id: e.id, label: e.label, theme: getTheme(e.id), builtIn: e.window ?? null, isDefault: false })),
  ];

  // Each thumbnail shows the real page at 1280 wide, shrunk to the card.
  let thumbW = $state<Record<string, number>>({});

  const SLEEVE = { x: 6, y: 46, w: 188, h: 248 };
  const prints = (t: Theme) => t.barPrint?.({ sleeve: SLEEVE }) ?? [];

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const days = (a: string, b: string) => Math.round((Date.parse(a) - Date.parse(b)) / 86_400_000);
  const plural = (n: number) => `${n} day${n === 1 ? '' : 's'}`;

  function status(c: Card): { text: string; tone: 'on' | 'soon' | 'off' } {
    if (c.isDefault) return { text: 'Always the fallback', tone: 'on' };
    const s = draft?.events[c.id];
    if (!s) return { text: '', tone: 'off' };
    if (draft!.theme === c.id) return { text: 'Forced on for everyone', tone: 'on' };
    if (!s.enabled) return { text: 'Switched off', tone: 'off' };
    const e = EVENTS.find((x) => x.id === c.id)!;
    const w = windowOf(e, s);
    if (!w) return { text: 'No dates: only runs when forced', tone: 'off' };
    if (today < w.from) return { text: `Starts in ${plural(days(w.from, today))}`, tone: 'soon' };
    if (today > w.to) return { text: `Ended ${plural(days(today, w.to))} ago`, tone: 'off' };
    return { text: `Running now, ${plural(days(w.to, today) + 1)} left`, tone: 'on' };
  }

  const copyLines: [string, keyof Theme['copy']][] = [
    ['Claim', 'landing.claim'],
    ['Reveal', 'reveal.headline'],
    ['Footer', 'landing.footer'],
  ];

  function traits(t: Theme): string[] {
    const out: string[] = [];
    if (t.trickOrTreat) out.push('Trick or treat: the room votes on tricks, and a door opens at the reveal');
    if (t.costumes) out.push('Players get a random costume emoji as their avatar');
    const n = prints(t).length;
    if (n) out.push(`${n} extra shape${n === 1 ? '' : 's'} printed on every bar's sleeve`);
    if (t.sounds.revealStart || t.sounds.barLit) {
      out.push(`Own sounds: ${[t.sounds.revealStart, t.sounds.barLit].filter(Boolean).map((s) => s!.replace(/^play/, '')).join(', ')}`);
    }
    if (t.effects.tearGlyphs?.length) out.push('Glyphs drift up with the tears');
    return out;
  }

  const activeLabel = $derived(view ? (cards.find((c) => c.id === view!.activeTheme)?.label ?? view.activeTheme) : '');
  const when = (ms: number) => (ms ? new Date(ms).toLocaleString() : 'never');

  // ── Advent calendar ───────────────────────────────────────────────────────
  const adventEvent = EVENTS.find((e) => e.advent);
  const DOOR_NUMBERS = Array.from({ length: 24 }, (_, i) => String(i + 1));
  // Every door gets a row to bind to, even before it has a prize.
  $effect(() => {
    if (!draft) return;
    for (const d of DOOR_NUMBERS) draft.advent.prizes[d] ??= { title: '', svg: '' };
  });
  let iconError = $state<Record<string, string>>({});
  const MAX_ICON = 12_000;
  async function pickIcon(d: string, e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || !draft) return;
    const text = (await file.text()).trim();
    if (!/^(<\?xml[^>]*>\s*)?(<!DOCTYPE[^>]*>\s*)?<svg[\s>]/i.test(text)) { iconError[d] = 'That is not an SVG.'; return; }
    if (text.length > MAX_ICON) { iconError[d] = `Too big (${Math.round(text.length / 1000)} KB). Keep it under 12 KB.`; return; }
    iconError[d] = '';
    draft.advent.prizes[d].svg = text;
  }
  const iconSrc = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  const dayLabel = (iso: string) =>
    new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  let openedBy = $derived(Object.fromEntries((view?.advent.opened ?? []).map((o) => [String(o.door), o])));
  let adventStatus = $derived.by(() => {
    if (!view) return '';
    const a = view.advent;
    if (!a.live) return `Not live: the calendar runs while ${adventEvent?.label ?? 'its theme'} is on (1 to 24 December ${a.year}).`;
    if (a.today < a.schedule[0].opensOn) return `Live, but the first door opens on ${dayLabel(a.schedule[0].opensOn)}.`;
    if (a.waiting.length) return `Live. ${a.opened.length} of 24 open; the next win opens door ${a.waiting[0]}${a.waiting.length > 1 ? ` (${a.waiting.length} waiting today)` : ''}.`;
    return `Live. ${a.opened.length} of 24 open; no door is waiting today.`;
  });
</script>

<svelte:head><meta name="robots" content="noindex" /></svelte:head>

<main class="admin">
  {#if !view || !draft}
    <section class="login">
      <h1>Admin</h1>
      <p class="muted">Settings for chocolottery. Sign in with the admin password.</p>
      <form onsubmit={login}>
        <label>Password
          <input type="password" bind:value={password} autocomplete="current-password" required />
        </label>
        <button class="btn btn-primary" type="submit" disabled={busy || !password}>{busy ? 'Signing in…' : 'Sign in'}</button>
        {#if loginError}<p class="error" role="alert">{loginError}</p>{/if}
      </form>
    </section>
  {:else}
    <header class="top">
      <div>
        <h1>Admin</h1>
        <p class="muted">Visitors see <b>{activeLabel}</b> right now.</p>
      </div>
      <div class="top-right">
        {#if view.sync.configured}
          <a class="sync ok" href={view.sync.historyUrl} target="_blank" rel="noreferrer" title="Every save is a commit on this branch">
            ⎇ {view.sync.target.split('@')[1].split(':')[0]}
          </a>
        {:else}
          <span class="sync warn" title="Set GITHUB_TOKEN and GITHUB_REPO to commit settings to git">⎇ not saving to git</span>
        {/if}
        {#if !open}<button class="btn btn-ghost" onclick={logout}>Sign out</button>{/if}
      </div>
    </header>
    <p class="muted small">Last saved {when(view.settings.updated_at)}{view.settings.updated_by ? ` by ${view.settings.updated_by}` : ''}.</p>

    <!-- Sound -->
    <section class="block">
      <h2>Sound pack</h2>
      <p class="muted">The effects every player hears: the countdown, the reveal, the win.</p>
      <div class="choices">
        {#each [
          { id: 'cheerful', name: 'Cheerful', text: 'The new one. Bells, mallets and brass in a little room; a snare roll builds the reveal; a wah-wah when the straw goes elsewhere.' },
          { id: 'classic', name: 'Classic', text: 'The original. Plain beeps and a sawtooth horn. Simpler, and some people liked it better.' },
        ] as p (p.id)}
          <label class="choice" class:on={draft.soundPack === p.id}>
            <input type="radio" name="pack" value={p.id} bind:group={draft.soundPack} />
            <span class="choice-body">
              <b>{p.name}</b>
              <span>{p.text}</span>
              <button type="button" class="btn btn-ghost small-btn" onclick={(e) => { e.preventDefault(); playPackSample(p.id as 'cheerful' | 'classic'); }}>▶ Hear it</button>
            </span>
          </label>
        {/each}
      </div>
    </section>

    <!-- Theme -->
    <section class="block">
      <h2>Theme</h2>
      <p class="muted">Follow the calendar, or force one look for everyone until you switch back.</p>
      <div class="row">
        <label class="inline">
          <span>Show</span>
          <select bind:value={draft.theme}>
            <option value="auto">Follow the calendar</option>
            <option value="default">Always the default</option>
            {#each EVENTS as e (e.id)}<option value={e.id}>Always {e.label}</option>{/each}
          </select>
        </label>
      </div>

      <div class="themes">
        {#each cards as c (c.id)}
          {@const st = status(c)}
          {@const s = draft.events[c.id]}
          <article class="theme" class:live={view.activeTheme === c.id}>
            <div class="thumb" aria-hidden="true" bind:clientWidth={thumbW[c.id]}>
              <iframe src={`/?theme=${c.id}&embed`} title={`${c.label} preview`} loading="lazy" tabindex="-1" style={`transform: scale(${(thumbW[c.id] || 320) / 1280})`}></iframe>
            </div>
            <div class="theme-body">
              <div class="theme-head">
                <h3>{c.label}</h3>
                <span class="pill {st.tone}">{st.text}</span>
              </div>

              <div class="swatches" title="What the confetti throws">
                {#each c.theme.effects.confettiColors as col, i (i)}<i style={`background:${col}`}></i>{/each}
              </div>
              <p class="glyphs" aria-label="Emoji in the burst">{c.theme.effects.emojiGlyphs.join(' ')}</p>

              <dl>
                {#each copyLines as [label, key] (key)}
                  <dt>{label}</dt><dd>{c.theme.copy[key]}</dd>
                {/each}
                <dt>Bar</dt><dd>{c.theme.copy['bar.tagline1']} · {c.theme.copy['bar.tagline2']}</dd>
              </dl>

              {#if traits(c.theme).length}
                <ul class="traits">{#each traits(c.theme) as t (t)}<li>{t}</li>{/each}</ul>
              {/if}

              <svg class="mini-sleeve" viewBox="0 40 200 260" role="img" aria-label={`${c.label} bar sleeve`}>
                <defs>
                  <linearGradient id={`g-${c.id}`} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stop-color="#FDE7A4" /><stop offset="0.35" stop-color="#E0B04A" />
                    <stop offset="0.6" stop-color="#F8D983" /><stop offset="1" stop-color="#A8781F" />
                  </linearGradient>
                </defs>
                <rect x={SLEEVE.x} y={SLEEVE.y} width={SLEEVE.w} height={SLEEVE.h} fill="#2E0F3A" />
                <rect x={SLEEVE.x + 8} y={SLEEVE.y + 8} width={SLEEVE.w - 16} height={SLEEVE.h - 16} rx="3" fill="none" stroke={`url(#g-${c.id})`} stroke-width="1.6" />
                <text x="100" y="140" text-anchor="middle" font-size="30" font-weight="900" font-style="italic" fill={`url(#g-${c.id})`}>MOVION</text>
                <text x="100" y="246" text-anchor="middle" font-size="7" font-weight="700" letter-spacing="1.6" fill={`url(#g-${c.id})`}>{c.theme.copy['bar.tagline1']}</text>
                <text x="100" y="257" text-anchor="middle" font-size="7" font-weight="700" letter-spacing="1.6" fill={`url(#g-${c.id})`}>{c.theme.copy['bar.tagline2']}</text>
                {#each prints(c.theme) as item, i (i)}
                  <path
                    d={item.d}
                    transform={item.transform}
                    fill={item.fill === 'gold' ? `url(#g-${c.id})` : (item.fill ?? '#F3CF6E')}
                    fill-rule={item.fillRule}
                    stroke={item.stroke === 'gold' ? `url(#g-${c.id})` : (item.stroke ?? 'none')}
                    stroke-width={item.strokeWidth}
                    stroke-linecap="round"
                    opacity={item.opacity}
                  />
                {/each}
              </svg>

              {#if !c.isDefault && s}
                <fieldset class="sched">
                  <legend>Schedule</legend>
                  <label class="check"><input type="checkbox" bind:checked={s.enabled} /> Runs on its dates{c.theme.trickOrTreat ? ' (and may be previewed with ?theme=)' : ''}</label>
                  <div class="dates">
                    <label>From <input type="date" bind:value={s.from} placeholder={c.builtIn?.from ?? ''} /></label>
                    <label>To <input type="date" bind:value={s.to} placeholder={c.builtIn?.to ?? ''} /></label>
                  </div>
                  <p class="hint">
                    {#if s.from && s.to}Using your dates.{:else if c.builtIn}Built-in dates: {c.builtIn.from} to {c.builtIn.to}. Pick both to change them.{:else}No built-in dates, so it never starts by itself. Pick both to give it a run.{/if}
                    {#if s.from || s.to}<button type="button" class="link" onclick={() => { s.from = ''; s.to = ''; }}>Clear</button>{/if}
                  </p>
                </fieldset>
              {/if}
            </div>
          </article>
        {/each}
      </div>
    </section>

    <!-- Defaults -->
    <section class="block">
      <h2>New games</h2>
      <p class="muted">What a game starts as. The host can still change both in the lobby.</p>
      <div class="row">
        <div class="seg" role="group" aria-label="Game style">
          <button type="button" aria-pressed={draft.defaults.style === 'bars'} onclick={() => (draft!.defaults.style = 'bars')}>🍫 Chocolate bars</button>
          <button type="button" aria-pressed={draft.defaults.style === 'straws'} onclick={() => (draft!.defaults.style = 'straws')}>🥤 Straws</button>
        </div>
        <label class="check"><input type="checkbox" bind:checked={draft.defaults.hostPlays} /> The host plays too</label>
      </div>
    </section>

    <!-- Advent calendar -->
    {#if adventEvent}
      <section class="block">
        <h2>Advent calendar</h2>
        <p class="muted">
          Every win opens the next door. Give each door a title and, if you like, an SVG picture (up to 12 KB).
          Doors without a title say "{adventEvent.advent?.surprise}". <a href="/advent" target="_blank" rel="noreferrer">See the calendar</a>
        </p>
        <p class="advent-status">{adventStatus}</p>
        <div class="dates">
          <label>Teaser from <input type="date" bind:value={draft.advent.teaseFrom} max={draft.advent.teaseTo || undefined} /></label>
          <label>Teaser until <input type="date" bind:value={draft.advent.teaseTo} min={draft.advent.teaseFrom || undefined} /></label>
          {#if draft.advent.teaseFrom || draft.advent.teaseTo}
            <button type="button" class="link" onclick={() => { draft!.advent.teaseFrom = ''; draft!.advent.teaseTo = ''; }}>No teaser</button>
          {/if}
        </div>
        <p class="hint">
          Before the first door opens, on these days the lobby says when the calendar starts and each reveal
          shows it with its doors still shut. Leave both empty for no teaser.
        </p>
        <div class="doors">
          {#each view.advent.schedule as day (day.door)}
            {@const d = String(day.door)}
            {@const p = draft.advent.prizes[d]}
            {#if p}
              <div class="door-row" class:opened={!!openedBy[d]}>
                <span class="door-no">{day.door}</span>
                <span class="door-day" title={day.opensOn !== day.date ? `Its own day is ${dayLabel(day.date)}` : ''}>
                  {dayLabel(day.opensOn)}{day.opensOn !== day.date ? ' *' : ''}
                </span>
                <span class="door-icon">
                  {#if p.svg}<img src={iconSrc(p.svg)} alt="" width="34" height="34" />{:else}<span aria-hidden="true">🎁</span>{/if}
                </span>
                <input class="door-title" type="text" maxlength="60" placeholder="Prize behind door {day.door}" bind:value={p.title} aria-label={`Door ${day.door} prize`} />
                <span class="door-actions">
                  <label class="btn btn-ghost small-btn">SVG<input type="file" accept=".svg,image/svg+xml" onchange={(e) => pickIcon(d, e)} hidden /></label>
                  {#if p.svg}<button type="button" class="link" onclick={() => (p.svg = '')}>Remove</button>{/if}
                </span>
                {#if openedBy[d]}<span class="door-opened">Opened by {openedBy[d].name}</span>{/if}
                {#if iconError[d]}<span class="door-error">{iconError[d]}</span>{/if}
              </div>
            {/if}
          {/each}
        </div>
        <p class="hint">* Weekend doors: Saturday's opens on the Friday before, Sunday's on the Monday after.</p>
      </section>
    {/if}

    <!-- Outing -->
    <section class="block">
      <h2>Team outing</h2>
      <p class="muted">The golden-ticket teaser shows from the first date and pays off on the day.</p>
      <div class="dates">
        <label>Teaser starts <input type="date" bind:value={draft.outing.teaseFrom} max={draft.outing.eventDate} /></label>
        <label>Outing day <input type="date" bind:value={draft.outing.eventDate} min={draft.outing.teaseFrom} /></label>
      </div>
    </section>

    <div class="savebar" class:dirty>
      <span class="savebar-text" aria-live="polite">
        {#if note}<span class="note {note.kind}">{note.text}</span>
        {:else if dirty}Unsaved changes
        {:else}Everything is saved{/if}
      </span>
      <button class="btn btn-ghost" onclick={discard} disabled={!dirty || busy}>Discard</button>
      <button class="btn btn-primary" onclick={save} disabled={!dirty || busy}>{busy ? 'Saving…' : 'Save'}</button>
    </div>
  {/if}
</main>

<style>
  .admin { max-width: 980px; margin: 0 auto; padding-bottom: 96px; }
  h1 { margin: 0; font-size: clamp(1.25rem, 2.6vw, 1.9rem); line-height: 1.1; font-weight: 900; font-stretch: 125%; letter-spacing: -0.02em; color: var(--gold); }
  h2 { margin: 0 0 4px; font-size: inherit; font-weight: 900; font-stretch: 118%; }
  h3 { margin: 0; font-size: inherit; font-weight: 800; }
  .muted { color: var(--text-mute); margin: 4px 0 14px; }
  .small { font-size: 0.75rem; margin: 0 0 8px; }

  .login { max-width: 360px; margin: 12vh auto 0; }
  .login form { display: grid; gap: 14px; margin-top: 18px; }
  .login label { display: grid; gap: 6px; font-weight: 600; }

  .top { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 12px; }
  .top-right { display: flex; align-items: center; gap: 10px; }
  .sync { font: 600 0.78rem var(--font-mono); padding: 6px 12px; border-radius: 999px; text-decoration: none; border: 1px solid var(--border); }
  .sync.ok { color: var(--green); }
  .sync.warn { color: var(--text-mute); }

  .block { margin: 28px 0 0; padding: 20px; border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--panel); }
  .row { display: flex; flex-wrap: wrap; align-items: center; gap: 14px 22px; }
  select, input[type='date'], input[type='password'] {
    font: inherit; color: var(--text); background: var(--bg-soft);
    border: 1px solid var(--border); border-radius: var(--radius); padding: 8px 10px;
  }
  select:focus-visible, input:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }
  .inline { display: inline-flex; align-items: center; gap: 10px; font-weight: 600; }
  .check { display: inline-flex; align-items: center; gap: 8px; cursor: pointer; }
  .check input { accent-color: var(--gold-deep); width: 18px; height: 18px; }

  .choices { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; }
  .choice { display: flex; gap: 12px; padding: 14px; border: 1px solid var(--border); border-radius: var(--radius); cursor: pointer; background: var(--bg-soft); }
  .choice.on { border-color: var(--gold); background: var(--accent-soft); }
  .choice input { margin-top: 4px; accent-color: var(--gold-deep); }
  .choice-body { display: grid; gap: 6px; justify-items: start; }
  .choice-body span { color: var(--text-mute); }
  .small-btn { padding: 6px 12px; }

  .themes { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; margin-top: 18px; }
  .theme { display: flex; flex-direction: column; border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden; background: var(--bg-soft); }
  .theme.live { border-color: var(--gold); box-shadow: 0 0 0 1px var(--gold); }
  .thumb { position: relative; aspect-ratio: 16 / 10; overflow: hidden; background: var(--bg); border-bottom: 1px solid var(--border); }
  .thumb iframe { position: absolute; top: 0; left: 0; width: 1280px; height: 800px; border: 0; transform-origin: 0 0; pointer-events: none; }
  .theme-body { display: grid; gap: 10px; padding: 14px; }
  .theme-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
  .pill { font: 600 0.72rem var(--font-mono); padding: 3px 10px; border-radius: 999px; border: 1px solid var(--border); color: var(--text-mute); }
  .pill.on { color: var(--green); border-color: var(--green); }
  .pill.soon { color: var(--gold); border-color: var(--gold-deep); }
  .swatches { display: flex; gap: 4px; }
  .swatches i { width: 22px; height: 22px; border-radius: 50%; border: 1px solid var(--border); }
  .glyphs { margin: 0; font-size: 1.2rem; letter-spacing: 0.15em; }
  dl { margin: 0; display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; font-size: 0.75rem; }
  dt { color: var(--text-dim); }
  dd { margin: 0; color: var(--text-mute); }
  .traits { margin: 0; padding-left: 18px; color: var(--text-mute); }
  .mini-sleeve { width: 100px; justify-self: start; border-radius: var(--radius-sm); }

  .sched { border: 1px solid var(--border-soft); border-radius: var(--radius); padding: 10px 12px; margin: 0; display: grid; gap: 10px; }
  .sched legend { padding: 0 6px; color: var(--text-dim); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.16em; }
  .dates { display: flex; flex-wrap: wrap; gap: 12px; }
  .dates label { display: grid; gap: 4px; font-weight: 600; }
  .hint { margin: 0; font-size: 0.75rem; color: var(--text-dim); }
  .link { background: none; border: 0; color: var(--gold); cursor: pointer; text-decoration: underline; padding: 0; font: inherit; }

  .seg { display: inline-flex; border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
  .seg button { font: inherit; color: var(--text); background: var(--bg-soft); border: 0; padding: 9px 16px; cursor: pointer; }
  .seg button[aria-pressed='true'] { background: var(--gold); color: var(--on-gold); font-weight: 700; }

  .advent-status { margin: 0 0 12px; font-weight: 600; }
  .doors { display: grid; grid-template-columns: repeat(auto-fill, minmax(420px, 1fr)); gap: 8px; }
  .door-row {
    display: grid; grid-template-columns: 30px 92px 36px 1fr auto; align-items: center; gap: 8px;
    padding: 6px 10px; border: 1px solid var(--border-soft); border-radius: var(--radius); background: var(--bg-soft);
  }
  .door-row.opened { border-color: var(--gold-deep); }
  .door-no { font: 800 1rem var(--font-dot); color: var(--gold); text-align: center; }
  .door-day { font-size: 0.75rem; color: var(--text-mute); }
  .door-icon { display: grid; place-items: center; width: 34px; height: 34px; font-size: 1.2rem; }
  .door-icon img { width: 34px; height: 34px; object-fit: contain; }
  .door-title { font: inherit; color: var(--text); background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 6px 8px; min-width: 0; }
  .door-actions { display: flex; align-items: center; gap: 6px; }
  .door-opened, .door-error { grid-column: 2 / -1; font-size: 0.75rem; }
  .door-opened { color: var(--gold); }
  .door-error { color: var(--red); }
  @media (max-width: 520px) { .doors { grid-template-columns: 1fr; } .door-row { grid-template-columns: 26px 1fr 36px; } .door-title, .door-actions { grid-column: 1 / -1; } }

  .savebar {
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 20;
    display: flex; align-items: center; justify-content: flex-end; gap: 10px; flex-wrap: wrap;
    padding: 12px 20px calc(12px + env(safe-area-inset-bottom));
    background: var(--panel-2); border-top: 1px solid var(--border);
  }
  .savebar.dirty { border-top-color: var(--gold); }
  .savebar-text { margin-right: auto; color: var(--text-mute); }
  .note.ok { color: var(--green); }
  .note.warn { color: var(--gold); }
  .note.bad { color: var(--red); }
  .error { color: var(--red); margin: 0; }
</style>

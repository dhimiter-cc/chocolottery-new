<script lang="ts">
  // Dev-only workbench for the sound effects: play each one, take a guided tour
  // of all of them, rate them without having to describe a sound in words, and
  // measure levels by rendering every sound offline.
  import {
    sounds, playCountdownBeep, playPick, playPaperRip, playFoilCrinkle,
    isMuted, setMuted, useAudioContext,
  } from '../lib/sound.js';

  interface Fx {
    id: string;
    name: string;
    /** Where the game plays it. */
    where: string;
    /** Roughly how long it rings, for the tour. */
    ms: number;
    run: () => void;
  }
  interface Group { title: string; fx: Fx[] }

  const groups: Group[] = [
    {
      title: 'Starting the round',
      fx: [
        { id: 'c3', name: '3', where: 'Countdown. A mallet on C.', ms: 900, run: () => playCountdownBeep(0) },
        { id: 'c2', name: '2', where: 'Countdown. A mallet on E.', ms: 900, run: () => playCountdownBeep(1) },
        { id: 'c1', name: '1', where: 'Countdown. A mallet on G.', ms: 900, run: () => playCountdownBeep(2) },
        { id: 'go', name: 'GO!', where: 'Countdown. A bright chord, a bell and a small crash.', ms: 1400, run: () => playCountdownBeep(3) },
        { id: 'pick', name: 'Pick', where: 'When you take a straw or a bar. Only you hear it.', ms: 700, run: () => playPick() },
      ],
    },
    {
      title: 'Unwrapping (chocolate bars)',
      fx: [
        { id: 'rip', name: 'Paper rip', where: 'Each tear of the sleeve.', ms: 500, run: () => playPaperRip() },
        { id: 'foil', name: 'Foil crinkle', where: 'Each tear of the foil.', ms: 500, run: () => playFoilCrinkle() },
      ],
    },
    {
      title: 'The build to the reveal',
      fx: [
        { id: 'roll', name: 'Snare roll', where: 'Straw mode: 3s before the winner. Speeds up and lands on a crash.', ms: 4400, run: () => sounds.playDrumroll(3000) },
        { id: 'riser', name: 'Riser', where: 'Straw mode: under the roll. A noise wash and a climbing tone.', ms: 3400, run: () => sounds.playRisingRumble(3000) },
        { id: 'build', name: 'Roll + riser', where: 'Bar mode: the 2.5s wait before the bar lights up.', ms: 4000, run: () => sounds.playRevealBuild(2500) },
        { id: 'chime', name: 'Sparkle chime', where: 'The moment the winner lights up.', ms: 1500, run: () => sounds.playSparkleChime() },
      ],
    },
    {
      title: 'The win',
      fx: [
        { id: 'fanfare', name: 'Fanfare', where: 'Winner only: a brass pickup and a held chord.', ms: 2700, run: () => sounds.playWinFanfare() },
        { id: 'tada', name: 'Ta-da', where: 'Everyone, a beat after the winner is named.', ms: 2000, run: () => sounds.playTada() },
        { id: 'horn', name: 'Party popper', where: 'Everyone, as the name appears. A pop, then confetti and glitter.', ms: 1200, run: () => sounds.playPartyPopper() },
        { id: 'cheer', name: 'Cheer', where: 'Winner only: a crowd and a few whoops.', ms: 2600, run: () => sounds.playCheer(2400) },
        { id: 'applause', name: 'Applause', where: 'Everyone.', ms: 3200, run: () => sounds.playApplause(3000) },
      ],
    },
    {
      title: 'The loss',
      fx: [
        {
          id: 'wah',
          name: 'Wah-wah',
          where: 'Straw mode only, for everyone who did not win. Chocolate bars is the default and has no loss sound: the whole room hears applause and a ta-da.',
          ms: 3000,
          run: () => sounds.playLoseTrombone(),
        },
      ],
    },
  ];

  const all: Fx[] = groups.flatMap((g) => g.fx);
  const byId = Object.fromEntries(all.map((f) => [f.id, f]));

  /** The whole reveal as a winner hears it, timed the way the reveal plays it. */
  function playWinnerReveal() {
    sounds.playRevealBuild(2500);
    const at = (ms: number, fn: () => void) => setTimeout(fn, ms);
    at(2500, () => sounds.playSparkleChime());
    at(3750, () => {
      sounds.playPartyPopper();
      sounds.playWinFanfare();
      sounds.playCheer(2400);
      sounds.playApplause(3000);
    });
    at(4850, () => sounds.playTada());
  }

  /** The same reveal for everyone else in the room. */
  function playRoomReveal() {
    sounds.playRevealBuild(2500);
    const at = (ms: number, fn: () => void) => setTimeout(fn, ms);
    at(2500, () => sounds.playSparkleChime());
    at(3750, () => {
      sounds.playPartyPopper();
      sounds.playApplause(2600);
    });
    at(4250, () => sounds.playTada());
  }

  let muted = $state(isMuted());
  function toggleMute() {
    muted = !muted;
    setMuted(muted);
  }

  // ── The tour ───────────────────────────────────────────────────────────────
  // Plays every sound in order with its name on screen, so you can follow along
  // and rate each one as it plays.
  let touring = $state(false);
  let nowId = $state<string | null>(null);
  let tourTimer: ReturnType<typeof setTimeout> | null = null;

  function playOne(f: Fx) {
    nowId = f.id;
    f.run();
  }

  function stopTour() {
    touring = false;
    if (tourTimer) clearTimeout(tourTimer);
    tourTimer = null;
  }

  function startTour() {
    stopTour();
    touring = true;
    let i = 0;
    const next = () => {
      if (!touring || i >= all.length) { touring = false; return; }
      const f = all[i++];
      playOne(f);
      tourTimer = setTimeout(next, f.ms + 700);
    };
    next();
  }

  // ── Feedback ───────────────────────────────────────────────────────────────
  // A verdict and a few tags per sound, turned into text you can paste back.
  const VERDICTS = [
    { key: 'love', label: '👍 Love it' },
    { key: 'ok', label: '😐 Fine' },
    { key: 'change', label: '👎 Change it' },
  ] as const;
  const TAGS = ['too quiet', 'too loud', 'too thin', 'too harsh', 'too long', 'too short', 'too silly', 'not happy enough'];

  let verdict = $state<Record<string, string>>({});
  let tags = $state<Record<string, string[]>>({});

  function setVerdict(id: string, key: string) {
    verdict[id] = verdict[id] === key ? '' : key;
  }
  function toggleTag(id: string, tag: string) {
    const cur = tags[id] ?? [];
    tags[id] = cur.includes(tag) ? cur.filter((t) => t !== tag) : [...cur, tag];
  }

  let feedback = $derived(
    all
      .filter((f) => verdict[f.id] || (tags[f.id] ?? []).length)
      .map((f) => {
        const v = VERDICTS.find((x) => x.key === verdict[f.id])?.label.replace(/^\S+ /, '') ?? '';
        const t = (tags[f.id] ?? []).join(', ');
        return `${f.name}: ${[v, t].filter(Boolean).join(' — ')}`;
      })
      .join('\n'),
  );
  let copied = $state(false);
  async function copyFeedback() {
    try {
      await navigator.clipboard.writeText(feedback);
      copied = true;
      setTimeout(() => (copied = false), 1800);
    } catch { /* the text box below can be selected by hand */ }
  }

  // ── Levels ───────────────────────────────────────────────────────────────
  interface Row { label: string; peak: number; rms: number; tail: number }
  let rows = $state<Row[]>([]);
  let measuring = $state(false);

  async function measure() {
    measuring = true;
    rows = [];
    const SR = 44100;
    const LEN = 8;
    const out: Row[] = [];
    for (const g of groups) {
      for (const fx of g.fx) {
        const ctx = new OfflineAudioContext(2, SR * LEN, SR);
        useAudioContext(ctx);
        try { fx.run(); } catch { /* a sound that throws shows as silent */ }
        const buf = await ctx.startRendering();
        let peak = 0, sum = 0, n = 0, last = 0;
        for (let c = 0; c < buf.numberOfChannels; c++) {
          const d = buf.getChannelData(c);
          for (let i = 0; i < d.length; i++) {
            const a = Math.abs(d[i]);
            if (a > peak) peak = a;
            if (a > 0.002) { sum += d[i] * d[i]; n++; if (i > last) last = i; }
          }
        }
        out.push({ label: `${g.title} · ${fx.name}`, peak, rms: n ? Math.sqrt(sum / n) : 0, tail: last / SR });
      }
    }
    useAudioContext(null);
    rows = out;
    measuring = false;
  }

  const db = (v: number) => (v > 0 ? (20 * Math.log10(v)).toFixed(1) : '−∞');
</script>

<main class="lab">
  <h1>Sound lab</h1>
  <p class="lead">
    Press <b>Play the tour</b> and every sound plays in order with its name on screen. Rate each one with the
    buttons under it, then copy the feedback at the bottom and paste it back.
  </p>

  <div class="bar">
    {#if touring}
      <button class="big" onclick={stopTour}>■ Stop the tour</button>
    {:else}
      <button class="big" onclick={startTour}>▶ Play the tour ({all.length} sounds)</button>
    {/if}
    <button onclick={playWinnerReveal}>▶ Whole reveal, as the winner</button>
    <button onclick={playRoomReveal}>▶ Whole reveal, as everyone else</button>
    <button onclick={toggleMute}>{muted ? '🔇 Muted: click to unmute' : '🔊 Sound on'}</button>
  </div>

  {#if muted}<p class="warn">Sound is muted for this browser, so nothing will play. Click the mute button above.</p>{/if}

  <div class="now" aria-live="polite">
    {#if nowId}Now playing: <b>{byId[nowId].name}</b>{:else}Nothing playing yet.{/if}
  </div>

  {#each groups as g (g.title)}
    <section>
      <h2>{g.title}</h2>
      {#each g.fx as fx (fx.id)}
        <div class="card" class:live={nowId === fx.id}>
          <div class="top">
            <button class="play" onclick={() => playOne(fx)} aria-label={`Play ${fx.name}`}>▶ {fx.name}</button>
            <span class="where">{fx.where}</span>
          </div>
          <div class="rate">
            {#each VERDICTS as v (v.key)}
              <button class="chip" class:on={verdict[fx.id] === v.key} onclick={() => setVerdict(fx.id, v.key)}>{v.label}</button>
            {/each}
          </div>
          <div class="rate tags">
            {#each TAGS as tag (tag)}
              <button class="chip small" class:on={(tags[fx.id] ?? []).includes(tag)} onclick={() => toggleTag(fx.id, tag)}>{tag}</button>
            {/each}
          </div>
        </div>
      {/each}
    </section>
  {/each}

  <section>
    <h2>Your feedback</h2>
    <textarea readonly rows="8" value={feedback || 'Rate a sound above and it shows up here.'}></textarea>
    <button onclick={copyFeedback} disabled={!feedback}>{copied ? '✓ Copied' : 'Copy feedback'}</button>
  </section>

  <section>
    <h2>Levels</h2>
    <button onclick={measure} disabled={measuring}>{measuring ? 'Rendering…' : 'Measure every sound'}</button>
    {#if rows.length}
      <table>
        <thead><tr><th>Sound</th><th>Peak dBFS</th><th>RMS dBFS</th><th>Ends at</th></tr></thead>
        <tbody>
          {#each rows as r (r.label)}
            <tr class:hot={r.peak >= 0.98} class:silent={r.peak < 0.001}>
              <td>{r.label}</td><td>{db(r.peak)}</td><td>{db(r.rms)}</td><td>{r.tail.toFixed(1)}s</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </section>
</main>

<style>
  .lab { max-width: 760px; margin: 0 auto; padding: 32px 20px 80px; color: var(--text); font-family: var(--font-sans); }
  h1 { margin: 0 0 8px; }
  h2 { margin: 28px 0 10px; font-size: 1rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-mute); }
  .lead { color: var(--text-mute); max-width: 60ch; }
  .bar { display: flex; flex-wrap: wrap; gap: 10px; margin: 20px 0 8px; }
  .warn { color: #ff8a7a; }
  .now {
    position: sticky; top: 0; z-index: 2; margin: 12px 0 0; padding: 10px 14px;
    border-radius: 10px; background: rgba(20, 6, 28, 0.92); border: 1px solid rgba(255, 255, 255, 0.16);
  }
  button {
    font: inherit; cursor: pointer; color: var(--text);
    background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.16);
    border-radius: 10px; padding: 10px 14px;
  }
  button:hover { background: rgba(255, 255, 255, 0.12); }
  button:disabled { opacity: 0.5; cursor: default; }
  .big { background: var(--gold); color: var(--on-gold); border-color: transparent; font-weight: 700; }
  .big:hover { background: var(--gold); filter: brightness(1.08); }
  .card {
    margin: 10px 0; padding: 12px 14px; border-radius: 12px;
    background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.1);
  }
  .card.live { border-color: var(--gold); background: rgba(243, 207, 110, 0.1); }
  .top { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 14px; }
  .play { font-weight: 700; }
  .where { flex: 1 1 260px; font-size: 0.85rem; color: var(--text-mute); }
  .rate { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
  .chip { padding: 6px 12px; border-radius: 999px; font-size: 0.85rem; }
  .chip.small { padding: 4px 10px; font-size: 0.78rem; }
  .chip.on { background: var(--gold); color: var(--on-gold); border-color: transparent; font-weight: 700; }
  textarea {
    width: 100%; box-sizing: border-box; margin-bottom: 10px; padding: 10px 12px; font: inherit;
    color: var(--text); background: rgba(0, 0, 0, 0.25); border: 1px solid rgba(255, 255, 255, 0.16); border-radius: 10px;
  }
  table { width: 100%; margin-top: 14px; border-collapse: collapse; font-variant-numeric: tabular-nums; font-size: 0.88rem; }
  th, td { padding: 6px 8px; text-align: left; border-bottom: 1px solid rgba(255, 255, 255, 0.1); }
  th { color: var(--text-mute); font-weight: 600; }
  tr.hot td { color: #ff8a7a; }
  tr.silent td { color: var(--text-mute); opacity: 0.6; }
</style>

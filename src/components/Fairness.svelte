<script lang="ts">
  // Fairness modal. Replaces the old version that built a giant HTML string and
  // injected it via {@html} (an XSS hole — player names went straight into
  // innerHTML) then re-attached click handlers with querySelectorAll + setTimeout.
  // Now a plain declarative table with a reactive expanded-row index.
  let { onClose }: { onClose: () => void } = $props();

  interface FairGame { month: string; participants: number; chance_pct: number; won: boolean; }
  interface FairVerdict { class: string; emoji: string; label: string; }
  interface FairPlayer {
    name: string;
    actual_wins: number;
    expected_wins: number | null;
    luck_score: number | null;
    verdict: FairVerdict | null;
    games: FairGame[];
  }
  interface FairData { players: FairPlayer[]; total_games: number; tracked_games: number; }

  let loading = $state(true);
  let error = $state(false);
  let data = $state<FairData | null>(null);
  let openIndex = $state<number | null>(null);

  $effect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/fairness');
        const d = await res.json();
        if (!cancelled) { data = d; loading = false; }
      } catch {
        if (!cancelled) { error = true; loading = false; }
      }
    })();
    return () => { cancelled = true; };
  });

  function toggleRow(i: number) {
    openIndex = openIndex === i ? null : i;
  }

  function fmtMonth(m: string) {
    if (!m) return '—';
    return new Date(m + '-02').toLocaleDateString('en', { month: 'short', year: 'numeric' });
  }

  // Build a fresh array whenever the data or the open row changes. Iterating a
  // newly-derived array (rather than reading openIndex inside the {#each}) is the
  // pattern that reliably re-renders the table here.
  let rows = $derived(
    (data?.players ?? []).map((p, i) => ({ p, i, isOpen: openIndex === i })),
  );

  let note = $derived.by(() => {
    if (!data) return '';
    const diff = data.total_games - data.tracked_games;
    return diff > 0
      ? `${diff} game${diff > 1 ? 's' : ''} predate participant tracking and are excluded from expected win calculations.`
      : '';
  });
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="modal" onclick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
  <div class="modal-card fairness-modal-card">
    <div class="section-head" style="margin-bottom:16px;">
      <h2>⚖️ Fairness Check</h2>
      <button type="button" class="btn btn-ghost" style="padding:4px 10px;" onclick={onClose}>✕</button>
    </div>
    <p class="muted">Actual wins vs. statistically expected wins — based on how many players were in each game.</p>

    <div style="margin-top:16px;">
      {#if loading}
        <p class="muted center">Loading…</p>
      {:else if error}
        <p class="error center">Could not load fairness data.</p>
      {:else if !data || data.players.length === 0}
        <p class="muted center">No games played yet — nothing to check!</p>
      {:else}
        <table class="leaderboard fairness-table">
          <thead><tr>
            <th>Name<span class="th-sub">click a row to see game history</span></th>
            <th>Wins<span class="th-sub">times you've won</span></th>
            <th>Expected<span class="th-sub">based on players per game</span></th>
            <th>Luck score<span class="th-sub">wins ÷ expected</span></th>
            <th>Verdict<span class="th-sub">our unbiased assessment</span></th>
          </tr></thead>
          <tbody>
            {#each rows as row}
              {@const p = row.p}
              <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
              <tr class="fairness-row" class:fairness-row-open={row.isOpen} onclick={() => toggleRow(row.i)}>
                <td><span class="fg-chevron">{row.isOpen ? '▾' : '▸'}</span> {p.name}</td>
                <td class="tc">{p.actual_wins}</td>
                <td class="tc">{p.expected_wins !== null ? p.expected_wins.toFixed(1) : '—'}</td>
                <td class="tc">{p.luck_score !== null ? p.luck_score.toFixed(2) : '—'}</td>
                <td>
                  {#if p.verdict}
                    <span class="fairness-verdict fairness-{p.verdict.class}">{p.verdict.emoji} {p.verdict.label}</span>
                  {:else}
                    <span class="fairness-verdict fairness-none">—</span>
                  {/if}
                </td>
              </tr>
              {#if row.isOpen}
                <tr class="fairness-detail">
                  <td colspan="5">
                    <div class="fg-detail-inner">
                      {#if p.games?.length}
                        <div class="fg-list">
                          {#each p.games as g (g.month + g.participants)}
                            <div class="fg-row">
                              <span class="fg-month">{fmtMonth(g.month)}</span>
                              <span class="fg-players">👥 {g.participants} players</span>
                              <span class="fg-chance">1 in {g.participants} &nbsp;·&nbsp; {g.chance_pct}% chance</span>
                              <span class="fg-result {g.won ? 'fg-won' : 'fg-lost'}">{g.won ? '🍫 Won' : '✗ Lost'}</span>
                            </div>
                          {/each}
                        </div>
                      {:else}
                        <p class="muted" style="margin:0;font-size:0.85rem;">No tracked games yet.</p>
                      {/if}
                    </div>
                  </td>
                </tr>
              {/if}
            {/each}
          </tbody>
        </table>
      {/if}
    </div>

    {#if note}<p class="muted" style="font-size:0.8rem;margin-top:14px;">{note}</p>{/if}
  </div>
</div>

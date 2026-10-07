<script lang="ts">
  // Dev-only workbench for the chocolate bar (/dev/bars): every unwrap frame
  // side by side, plus the phone scratch view against a fake server.
  import ChocolateBar from './ChocolateBar.svelte';
  import UnwrapStage from './UnwrapStage.svelte';
  import { UNWRAP_STEPS } from '../lib/bars.js';

  const steps = Array.from({ length: UNWRAP_STEPS + 1 }, (_, i) => i);

  let scratching = $state(false);
  let log = $state<string[]>([]);

  function open() {
    log = [];
    scratching = true;
  }

  // Stand-in for POST /api/unwrap.
  function onProgress(step: number) {
    log = [...log, `step ${step}`];
  }
</script>

<main class="lab">
  <h1>Chocolate bar lab</h1>
  <p>Every frame of the unwrap, bar Nº 07. The last two are what the reveal shows: bare chocolate until it runs, then the ticket.</p>

  <div class="lab-row">
    {#each steps as s (s)}
      <figure>
        <ChocolateBar step={s} number={7}  name={s === 0 ? 'Dhimiter' : ''} />
        <figcaption>{s}{s === UNWRAP_STEPS ? ' · open' : ''}</figcaption>
      </figure>
    {/each}
    <figure>
      <ChocolateBar step={UNWRAP_STEPS} number={7} golden={true} />
      <figcaption>{UNWRAP_STEPS} · golden</figcaption>
    </figure>
  </div>

  <h2>Numbers seed their own tears</h2>
  <div class="lab-row">
    {#each [1, 2, 3, 12, 15] as n (n)}
      <figure>
        <ChocolateBar step={3} number={n} boil />
        <figcaption>Nº {n} · step 3</figcaption>
      </figure>
    {/each}
  </div>

  <div class="lab-actions">
    <button class="btn btn-primary" onclick={open}>Scratch one</button>
  </div>
</main>

{#if scratching}
  <UnwrapStage number={7} suspense="Somewhere in this room, a bar is hiding gold." {onProgress}>
    {#snippet corner()}
      <button type="button" class="unwrap-chip" onclick={() => (scratching = false)}>✕ close</button>
    {/snippet}
    {#snippet footer()}
      <span>{log.join(' → ') || 'nothing sent yet'}</span>
    {/snippet}
  </UnwrapStage>
{/if}

<style>
  .lab { max-width: 1200px; margin: 0 auto; padding: 24px 16px 60px; }
  .lab-row {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
    gap: 18px;
    padding: 20px;
    border-radius: 16px;
    background: radial-gradient(ellipse at 50% 30%, #3A1648, #16051D 70%);
  }
  figure { margin: 0; }
  figcaption { margin-top: 6px; text-align: center; color: #F3E7CE; font: 600 0.75rem var(--font-mono); }
  .lab-actions { display: flex; gap: 10px; margin-top: 20px; }
</style>

<script lang="ts">
  // Declarative 3-2-1-GO countdown. Replaces the old imperative version in
  // Game.svelte that created/removed .countdown-overlay nodes by hand.
  // Parent calls `run()` (via bind:this) on the lobby→picking transition and
  // reads `onActiveChange` to lock picking + dim the straws while it plays.
  import { tone } from '../lib/sound.js';

  let { onActiveChange }: { onActiveChange?: (active: boolean) => void } = $props();

  interface Step { text: string; freq: number; dur: number; big?: boolean; small?: boolean; }
  const steps: Step[] = [
    { text: '3', freq: 440, dur: 700 },
    { text: '2', freq: 494, dur: 700 },
    { text: '1', freq: 554, dur: 700 },
    { text: 'GO!', freq: 880, dur: 700, big: true },
    { text: 'Pick your straw', freq: 0, dur: 900, small: true },
  ];

  let stepIndex = $state(-1);
  let popKey = $state(0); // bumping this re-mounts the overlay, restarting the pop animation
  let timer: ReturnType<typeof setTimeout> | null = null;

  let current = $derived(stepIndex >= 0 && stepIndex < steps.length ? steps[stepIndex] : null);

  export function run() {
    if (stepIndex >= 0 && stepIndex < steps.length) return; // already running
    onActiveChange?.(true);
    stepIndex = -1;
    tick();
  }

  function tick() {
    stepIndex++;
    if (stepIndex >= steps.length) {
      onActiveChange?.(false);
      return;
    }
    const step = steps[stepIndex];
    popKey++;
    if (step.freq) {
      tone(step.freq, step.big ? 0.35 : 0.12, step.big ? 'triangle' : 'square', step.big ? 0.2 : 0.14);
    }
    timer = setTimeout(tick, step.dur);
  }

  $effect(() => () => { if (timer) clearTimeout(timer); });
</script>

{#if current}
  {#key popKey}
    <div class="countdown-overlay pop" class:big={current.big} class:small={current.small}>
      {current.text}
    </div>
  {/key}
{/if}

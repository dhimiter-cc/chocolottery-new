<script lang="ts">
  // Declarative 3-2-1-GO countdown. Replaces the old imperative version in
  // Game.svelte that created/removed .countdown-overlay nodes by hand.
  // Parent calls `run()` (via bind:this) on the lobby→picking transition and
  // reads `onActiveChange` to lock picking + dim the straws while it plays.
  import { playCountdownBeep } from '../lib/sound.js';

  let { onActiveChange }: { onActiveChange?: (active: boolean) => void } = $props();

  // `beep` is which sound plays with the step: 0, 1, 2 climb, 3 is GO.
  interface Step { text: string; beep?: number; dur: number; big?: boolean; small?: boolean; }
  const steps: Step[] = [
    { text: '3', beep: 0, dur: 700 },
    { text: '2', beep: 1, dur: 700 },
    { text: '1', beep: 2, dur: 700 },
    { text: 'GO!', beep: 3, dur: 700, big: true },
    { text: 'Pick your chocolate', dur: 900, small: true },
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
    if (step.beep !== undefined) playCountdownBeep(step.beep);
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

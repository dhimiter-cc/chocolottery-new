<script lang="ts">
  // One bar on the host's board. The board only learns someone's progress on
  // each poll, so a player can jump from step 2 to step 5 between two of them.
  // Instead of cutting straight to 5, this plays 3 → 4 → 5 at 12 fps — the
  // board looks like a live feed rather than a slideshow.
  import { untrack } from 'svelte';
  import ChocolateBar from './ChocolateBar.svelte';

  let {
    step,
    number,
    name = '',
    golden = null,
  }: {
    step: number;
    number: number;
    name?: string;
    golden?: boolean | null;
  } = $props();

  const FRAME_MS = 83;
  let shown = $state(0);
  let primed = false;

  // Only `step` drives this. `shown` is read untracked, or every frame the
  // interval advances would tear the interval down and start it again.
  $effect(() => {
    const target = step;
    const current = untrack(() => shown);
    // First render, or a restart moving backwards: no catching up to do.
    if (!primed || target < current) {
      primed = true;
      shown = target;
      return;
    }
    if (target === current) return;
    const id = setInterval(() => {
      if (shown < target) shown += 1;
      if (shown >= target) clearInterval(id);
    }, FRAME_MS);
    return () => clearInterval(id);
  });
</script>

<ChocolateBar step={shown} {number} {name} golden={shown >= step ? golden : null} scraps />

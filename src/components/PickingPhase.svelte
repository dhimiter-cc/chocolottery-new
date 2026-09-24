<script lang="ts">
  import type { GameStateResponse } from '../lib/types.js';
  import { showToast } from '../lib/toast.svelte.js';

  let { game, onPick, locked = false }:
    { game: GameStateResponse; onPick: (index: number) => void; locked?: boolean } = $props();

  const QUIPS = [
    "Pick a straw. Try to look casual.",
    "Trust your gut. Or don't. It's already decided.",
    "Choose wisely. Or wildly. We're not your boss.",
    "It's just a straw. With life-altering consequences.",
    "Statistically speaking, one of these is the bad one.",
    "Pam would never. Be Pam. Or don't.",
  ];

  let quip = $derived.by(() => {
    const seed = (game.my_token || '').charCodeAt(0) || 0;
    return QUIPS[seed % QUIPS.length];
  });

  let justPicked: Set<number> = $state(new Set());
  let pickInFlight = $state(false);

  let pickedCount = $derived(game.players.filter(p => p.picked).length);
  let total = $derived(game.players.length);
  let remaining = $derived(total - pickedCount);
  let allPicked = $derived(remaining === 0);

  // The host's screen when the host only oversees: same cup, nothing to draw.
  let spectating = $derived(game.is_host && !game.host_plays);

  let phaseText = $derived.by(() => {
    if (allPicked) return '🥁 The drumroll, please…';
    if (spectating) return `${remaining} still to draw.`;
    if (game.my_straw == null) return quip;
    return `Locked in. Waiting for ${remaining} more brave soul${remaining === 1 ? '' : 's'}.`;
  });

  function isTaken(i: number) {
    return game.players.some(p => p.straw_index === i);
  }

  function isMine(i: number) {
    return game.my_straw === i;
  }

  function getStrawPlayer(i: number) {
    return game.players.find(p => p.straw_index === i) ?? null;
  }

  async function handleStrawClick(i: number) {
    if (locked || spectating) return;
    if (pickInFlight) return;
    if (game.my_straw != null) return;
    if (isTaken(i)) {
      showToast("Someone beat you to that one");
      return;
    }
    pickInFlight = true;
    justPicked = new Set([...justPicked, i]);
    setTimeout(() => {
      justPicked = new Set([...justPicked].filter(x => x !== i));
    }, 700);
    await onPick(i);
    pickInFlight = false;
  }

  let strawCount = $derived(game.straws ? game.straws.length : game.players.length || 4);
</script>

<!-- Phase detail strip above straws -->
<div style="position:absolute;top:14px;left:0;right:0;text-align:center;z-index:2;">
  <span style="font-size:0.88rem;font-style:italic;color:rgba(255,230,160,0.6);">{phaseText}</span>
</div>

<!-- Straws -->
<div class="straws" class:drumroll={allPicked}>
  {#each Array.from({ length: strawCount }, (_, i) => i) as i}
    {@const taken = isTaken(i)}
    {@const mine = isMine(i)}
    {@const disabled = game.my_straw !== null || locked || spectating}
    {@const player = getStrawPlayer(i)}
    {@const picking = justPicked.has(i)}

    <button
      type="button"
      class="straw"
      class:taken={taken}
      class:mine={mine}
      class:disabled={disabled && !taken}
      class:just-picked={picking}
      disabled={disabled && taken}
      aria-pressed={mine}
      aria-label={taken ? `Straw ${i + 1}, taken by ${player?.is_me ? 'you' : player?.name}` : `Straw ${i + 1}`}
      onclick={() => handleStrawClick(i)}
      style="height: 240px;"
    >
      <div class="straw-number">{i + 1}</div>
      {#if player}
        <div class="straw-tag">{player.is_me ? 'you' : player.name}</div>
      {/if}
    </button>
  {/each}
</div>
<div class="cup"></div>

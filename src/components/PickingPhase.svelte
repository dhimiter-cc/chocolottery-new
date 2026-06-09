<script lang="ts">
  import type { GameStateResponse } from '../lib/types.js';

  let { state, onPick }: { state: GameStateResponse; onPick: (index: number) => void } = $props();

  const QUIPS = [
    "Pick a straw. Try to look casual.",
    "Trust your gut. Or don't. It's already decided.",
    "Choose wisely. Or wildly. We're not your boss.",
    "It's just a straw. With life-altering consequences.",
    "Statistically speaking, one of these is the bad one.",
    "Pam would never. Be Pam. Or don't.",
  ];

  let quip = $derived.by(() => {
    const seed = (state.my_token || '').charCodeAt(0) || 0;
    return QUIPS[seed % QUIPS.length];
  });

  let justPicked: Set<number> = $state(new Set());
  let pickInFlight = $state(false);

  let pickedCount = $derived(state.players.filter(p => p.picked).length);
  let total = $derived(state.players.length);
  let remaining = $derived(total - pickedCount);
  let allPicked = $derived(remaining === 0);

  let phaseText = $derived.by(() => {
    if (allPicked) return '🥁 The drumroll, please…';
    if (state.my_straw == null) return quip;
    return `Locked in. Waiting for ${remaining} more brave soul${remaining === 1 ? '' : 's'}.`;
  });

  function isTaken(i: number) {
    return state.players.some(p => p.straw_index === i);
  }

  function isMine(i: number) {
    return state.my_straw === i;
  }

  function getStrawPlayer(i: number) {
    return state.players.find(p => p.straw_index === i) ?? null;
  }

  async function handleStrawClick(i: number) {
    if (pickInFlight) return;
    if (state.my_straw != null) return;
    if (isTaken(i)) return;
    pickInFlight = true;
    justPicked = new Set([...justPicked, i]);
    setTimeout(() => {
      justPicked = new Set([...justPicked].filter(x => x !== i));
    }, 700);
    await onPick(i);
    pickInFlight = false;
  }

  let strawCount = $derived(state.straws ? state.straws.length : state.players.length || 4);
</script>

{#if state.in_game === false}
  <div class="excluded-banner">
    <div class="excluded-icon">😬</div>
    <div class="excluded-title">You missed this round</div>
    <div class="excluded-body">The game started while your connection appeared offline — likely because the tab was in the background on your phone. You'll be back in for the next one.</div>
  </div>
{:else}
  <!-- Phase detail strip above straws -->
  <div style="position:absolute;top:14px;left:0;right:0;text-align:center;z-index:2;">
    <span style="font-size:0.88rem;font-style:italic;color:rgba(255,230,160,0.6);">{phaseText}</span>
  </div>

  <!-- Straws -->
  <div class="straws" class:drumroll={allPicked}>
    {#each Array.from({ length: strawCount }, (_, i) => i) as i}
      {@const taken = isTaken(i)}
      {@const mine = isMine(i)}
      {@const disabled = state.my_straw !== null || taken}
      {@const player = getStrawPlayer(i)}
      {@const picking = justPicked.has(i)}

      <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
      <div
        class="straw"
        class:taken={taken}
        class:mine={mine}
        class:disabled={disabled && !taken}
        class:just-picked={picking}
        onclick={() => handleStrawClick(i)}
        style="height: 240px;"
      >
        <div class="straw-number">{i + 1}</div>
        {#if player}
          <div class="straw-tag">{player.is_me ? 'you' : player.name}</div>
        {/if}
      </div>
    {/each}
  </div>
  <div class="cup"></div>
{/if}

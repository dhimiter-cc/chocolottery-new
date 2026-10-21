<script lang="ts">
  import type { GameStateResponse } from '../lib/types.js';
  import JoinQR from './JoinQR.svelte';
  import VoteLine from './VoteLine.svelte';
  import { TRICK_ODDS } from '../lib/trickOdds.js';
  import { currentTheme } from '../themes/client.js';

  // Some themes (Halloween) show each player's random costume instead of their initial.
  const costumes = currentTheme().costumes;

  // `joinUrl` is only passed on the host's screen: the QR sits beside the room
  // so people can scan it off the wall.
  // With `code`, the treat votes (and trick votes, on themes that have them) sit at
  // the bottom of the canvas as two slim lines, where the room is already looking.
  let {
    game,
    joinUrl = '',
    code = '',
    onRefresh,
    onOpenCupboard,
  }: {
    game: GameStateResponse;
    joinUrl?: string;
    code?: string;
    onRefresh?: () => void;
    onOpenCupboard?: () => void;
  } = $props();

  const theme = currentTheme();
  const copy = theme.copy;
  const trickWords = theme.trickOrTreat;
  let stocked = $derived(game.cupboard.filter((c) => c.stock > 0).map((c) => c.name));
  // The cupboard button's leading emoji, as a compact icon button.
  const cupboardIcon = copy['snacks.cupboardBtn'].split(' ')[0];

  function avatarColor(name: string): string {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
    const hue = ((h % 360) + 360) % 360;
    return `linear-gradient(160deg, hsl(${hue} 70% 60%), hsl(${(hue + 30) % 360} 60% 38%))`;
  }

  function avatarInitial(name: string): string {
    return (name || '?').trim().charAt(0).toUpperCase();
  }
</script>

<div class="stage-overlay lobby" class:lobby-with-qr={!!joinUrl}>
  {#if joinUrl}<JoinQR url={joinUrl} />{/if}
  <div class="lobby-room">
  <div class="overlay-headline">In the room{joinUrl ? ` · ${game.players.length}` : ''}</div>
  <div class="lobby-players">
    {#each game.players as player (player.token)}
      <div
        class="lobby-player"
        class:offline={!player.online}
        class:me={player.is_me}
        title="{player.name}{player.online ? '' : ' (offline)'}"
      >
        <div class="avatar" class:costume={costumes && !!player.costume} style="background: {avatarColor(player.name)};">
          {costumes && player.costume ? player.costume : avatarInitial(player.name)}
        </div>
        <div class="name">{player.is_me ? player.name + ' (you)' : player.name}</div>
      </div>
    {/each}
  </div>
  {#if game.players.length === 0}
    <div class="overlay-sub">Waiting for someone — anyone — to show up.</div>
  {/if}
  <!-- A host who only oversees isn't in the room list (or the draw). -->
  {#if game.host && !game.host_plays}
    <div class="lobby-host">Hosted by {game.host.is_me ? 'you' : game.host.name} · not in the draw</div>
  {/if}
  </div>
  {#if code}
    <div class="lobby-votes">
      <VoteLine
        kind="snack"
        {code}
        icon={copy['snacks.itemIcon'] || '🍫'}
        label={copy['snacks.title']}
        hint="Highest-voted wins the prize snack. A tie or no votes is random."
        items={game.suggestions}
        quick={stocked}
        placeholder="Tim Tams, Speculoos…"
        empty="Nothing yet. Tap + to suggest."
        {onRefresh}
      >
        {#snippet extra()}
          {#if onOpenCupboard}
            <button type="button" class="vline-ghost" aria-label={copy['snacks.cupboardBtn']} title={copy['snacks.cupboardBtn']} onclick={onOpenCupboard}>{cupboardIcon}</button>
          {/if}
        {/snippet}
      </VoteLine>
      {#if trickWords}
        <VoteLine
          kind="trick"
          {code}
          icon="🕷️"
          label={trickWords.title}
          hint={trickWords.hint.replace('{odds}', String(TRICK_ODDS))}
          items={game.tricks}
          placeholder={trickWords.placeholder}
          empty="Add a trick: the round needs one."
          attention={game.tricks.length === 0}
          {onRefresh}
        />
      {/if}
    </div>
  {/if}
</div>

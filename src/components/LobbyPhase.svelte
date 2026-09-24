<script lang="ts">
  import type { GameStateResponse } from '../lib/types.js';
  import JoinQR from './JoinQR.svelte';

  // `joinUrl` is only passed on the host's screen: the QR sits beside the room
  // so people can scan it off the wall.
  let { game, joinUrl = '' }: { game: GameStateResponse; joinUrl?: string } = $props();

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
        <div class="avatar" style="background: {avatarColor(player.name)};">
          {avatarInitial(player.name)}
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
</div>

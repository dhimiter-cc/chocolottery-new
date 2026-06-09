<script lang="ts">
  import type { GameStateResponse } from '../lib/types.js';

  let { game }: { game: GameStateResponse } = $props();

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

<div class="stage-overlay lobby">
  <div class="overlay-headline">In the room</div>
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
</div>

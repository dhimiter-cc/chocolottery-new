<script lang="ts">
  // Mute switch for every sound the game makes. Remembered per browser. The
  // initial state is read after mount so the server render (always unmuted)
  // and the hydrated client agree.
  import { isMuted, setMuted } from '../lib/sound.js';

  let muted = $state(false);
  $effect(() => { muted = isMuted(); });

  function toggle() {
    muted = !muted;
    setMuted(muted);
  }
</script>

<button
  type="button"
  class="btn btn-ghost icon-btn sound-toggle"
  aria-pressed={muted}
  aria-label={muted ? 'Sound is off. Turn it on' : 'Sound is on. Turn it off'}
  title={muted ? 'Sound off' : 'Sound on'}
  onclick={toggle}
>
  <span aria-hidden="true">{muted ? '🔇' : '🔊'}</span>
</button>

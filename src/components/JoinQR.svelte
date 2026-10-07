<script lang="ts">
  // "Scan to join" for the host's screen. Out of the way by default: a small QR
  // chip in the stage's top-left corner. Click it and it grows to projector
  // size for the room to scan; click anywhere (or press Esc) and it shrinks
  // back. Rendered as inline SVG so it stays crisp at any size. The URL is
  // printed underneath for anyone whose camera won't cooperate.
  import QRCode from 'qrcode';

  let { url }: { url: string } = $props();

  let svg = $state('');
  $effect(() => {
    let live = true;
    QRCode.toString(url, {
      type: 'svg',
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#16051D', light: '#FFFFFF' },
    })
      .then((s) => { if (live) svg = s; })
      .catch(() => { if (live) svg = ''; });
    return () => { live = false; };
  });

  let shortUrl = $derived(url.replace(/^https?:\/\//, ''));
  let big = $state(false);
</script>

<svelte:window onkeydown={(e) => { if (big && e.key === 'Escape') big = false; }} />

<!-- Generated locally by the qrcode package from our own URL, not user input. -->
{#if big}
  <button type="button" class="join-qr-backdrop" aria-label="Shrink the QR code" onclick={() => (big = false)}>
    <span class="join-qr-big">
      <span class="join-qr-code" role="img" aria-label="QR code to join the game at {shortUrl}">{@html svg}</span>
      <span class="join-qr-label">Scan to join</span>
      <span class="join-qr-url">{shortUrl}</span>
    </span>
  </button>
{:else}
  <button type="button" class="join-qr-chip" aria-label="Show the join QR code bigger" onclick={() => (big = true)}>
    <span class="join-qr-mini" aria-hidden="true">{@html svg}</span>
    <span class="join-qr-chip-label">Scan to join</span>
  </button>
{/if}

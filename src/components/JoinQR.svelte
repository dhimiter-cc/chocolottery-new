<script lang="ts">
  // "Scan to join" for the host's screen: the room points their phones at the
  // wall instead of passing a link around. Rendered as inline SVG so it stays
  // crisp at projector size. The URL is printed underneath for anyone whose
  // camera won't cooperate.
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
</script>

<div class="join-qr">
  <div class="join-qr-code" role="img" aria-label="QR code to join the game at {shortUrl}">
    <!-- Generated locally by the qrcode package from our own URL, not user input. -->
    {@html svg}
  </div>
  <div class="join-qr-label">Scan to join</div>
  <div class="join-qr-url">{shortUrl}</div>
</div>

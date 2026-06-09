<script lang="ts">
  // Svelte 5 runes ($effect, $state, $props) are compiler built-ins — no import needed

  interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    g: number;
    drag: number;
    size: number;
    rot: number;
    vr: number;
    color: string;
    life: number;
    maxLife: number;
    kind: 'rect' | 'circle' | 'tear' | 'star' | 'streamer' | 'spark' | 'ring' | 'emoji';
    grow?: number;   // radius growth per frame (used by 'ring' shockwaves)
    glyph?: string;  // character to draw (used by 'emoji')
  }

  let canvas: HTMLCanvasElement;
  let particles: Particle[] = [];
  let rafId: number | null = null;

  function rand(min: number, max: number) {
    return min + Math.random() * (max - min);
  }

  function spawnParticle(opts: Partial<Particle> & { x: number; y: number; color: string; kind: Particle['kind'] }): Particle {
    return {
      x: opts.x,
      y: opts.y,
      vx: opts.vx ?? rand(-3, 3),
      vy: opts.vy ?? rand(-8, -2),
      g: opts.g ?? 0.22,
      drag: opts.drag ?? 0.993,
      size: opts.size ?? rand(6, 12),
      rot: rand(0, Math.PI * 2),
      vr: rand(-0.15, 0.15),
      color: opts.color,
      life: 0,
      maxLife: opts.maxLife ?? rand(180, 280),
      kind: opts.kind,
      grow: opts.grow,
      glyph: opts.glyph,
    };
  }

  function launchCannon(
    xFrac: number,
    angleDeg: number,
    count: number,
    colors: string[],
    spread: number,
    gravity: number,
    drag: number,
    speedMin: number,
    speedMax: number,
    maxLifeMin: number,
    maxLifeMax: number,
    kind: Particle['kind'],
    sizeMin: number,
    sizeMax: number,
  ) {
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);
    const cx = w * xFrac;
    const cy = h * 0.85;
    const baseAngle = (angleDeg * Math.PI) / 180;

    for (let i = 0; i < count; i++) {
      const angle = baseAngle + rand(-spread, spread);
      const speed = rand(speedMin, speedMax);
      particles.push(
        spawnParticle({
          x: cx,
          y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          g: gravity,
          drag,
          size: rand(sizeMin, sizeMax),
          color: colors[Math.floor(Math.random() * colors.length)],
          maxLife: rand(maxLifeMin, maxLifeMax),
          kind,
        }),
      );
    }
  }

  const CONFETTI_COLORS = ['#E89817', '#FFD24A', '#E63946', '#6366F1', '#0F9D6E', '#FFFFFF', '#FF7AD5', '#22D3EE'];

  function spawnEmojiBurst(n: number) {
    const glyphs = ['🎉', '🍫', '👏', '✨', '🎊'];
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);
    for (let i = 0; i < n; i++) {
      particles.push(
        spawnParticle({
          x: rand(0.18, 0.82) * w,
          y: h * 0.92,
          vx: rand(-4.5, 4.5),
          vy: rand(-16, -9),
          g: 0.3,
          drag: 0.995,
          size: rand(10, 16),
          color: '#fff',
          maxLife: rand(150, 220),
          kind: 'emoji',
          glyph: glyphs[Math.floor(Math.random() * glyphs.length)],
        }),
      );
    }
  }

  export function fireConfetti(big: boolean) {
    const count = big ? 260 : 180;
    const colors = CONFETTI_COLORS;
    const perEmitter = Math.floor(count / 3);

    // Left cannon
    launchCannon(0.12, -60, perEmitter, colors, 0.45, 0.22, 0.993, 8, 18, 180, 280, 'rect', 6, 12);
    // Right cannon
    launchCannon(0.88, -120, perEmitter, colors, 0.45, 0.22, 0.993, 8, 18, 180, 280, 'rect', 6, 12);
    // Top burst
    launchCannon(0.5, -90, count - perEmitter * 2, colors, 0.7, 0.22, 0.993, 6, 16, 180, 280, 'circle', 5, 10);

    // Glittering stars arcing in from the sides
    launchCannon(0.12, -62, big ? 42 : 26, ['#FFD24A', '#FFFBE0', '#FF7AD5'], 0.5, 0.18, 0.99, 9, 18, 200, 300, 'star', 9, 16);
    launchCannon(0.88, -118, big ? 42 : 26, ['#FFD24A', '#FFFBE0', '#22D3EE'], 0.5, 0.18, 0.99, 9, 18, 200, 300, 'star', 9, 16);
    // Slow tumbling streamers
    launchCannon(0.5, -90, big ? 30 : 18, colors, 0.6, 0.12, 0.992, 7, 14, 240, 340, 'streamer', 12, 22);

    // A few emoji lobbed up for good measure
    spawnEmojiBurst(big ? 16 : 9);

    ensureLoop();
  }

  // Timed aerial firework bursts: each pops a shockwave ring + a radial spray of sparks.
  export function fireFireworks(bursts = 6) {
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);
    const palettes = [
      ['#FFD24A', '#E89817', '#FFFBE0'],
      ['#FF7AD5', '#E63946', '#FFFFFF'],
      ['#22D3EE', '#6366F1', '#FFFFFF'],
      ['#0F9D6E', '#A7F3D0', '#FFD24A'],
    ];
    let delay = 0;
    for (let b = 0; b < bursts; b++) {
      setTimeout(() => {
        if (!canvas) return;
        const cx = rand(0.18, 0.82) * w;
        const cy = rand(0.12, 0.45) * h;
        const pal = palettes[Math.floor(Math.random() * palettes.length)];

        // Shockwave ring
        particles.push(
          spawnParticle({
            x: cx, y: cy, vx: 0, vy: 0, g: 0, drag: 1,
            size: 2, grow: rand(2.2, 3.4),
            color: pal[0], maxLife: rand(28, 42), kind: 'ring',
          }),
        );

        // Radial spark spray
        const n = 42;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + rand(-0.05, 0.05);
          const sp = rand(3, 7);
          particles.push(
            spawnParticle({
              x: cx, y: cy,
              vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
              g: 0.05, drag: 0.95,
              size: rand(3, 6),
              color: pal[Math.floor(Math.random() * pal.length)],
              maxLife: rand(50, 100), kind: 'spark',
            }),
          );
        }
        ensureLoop();
      }, delay);
      delay += rand(220, 420);
    }
  }

  export function fireTears() {
    const colors = ['#7AB6E8', '#9CC8EE', '#B5D6F2', '#5C9DD8'];
    const w = canvas.width / (window.devicePixelRatio || 1);

    function spawnBurst(n: number) {
      for (let i = 0; i < n; i++) {
        particles.push(
          spawnParticle({
            x: rand(0.05, 0.95) * w,
            y: rand(-20, 0),
            vx: rand(-1.5, 1.5),
            vy: rand(1.5, 4),
            g: 0.08,
            drag: 0.999,
            size: rand(5, 9),
            color: colors[Math.floor(Math.random() * colors.length)],
            maxLife: rand(200, 340),
            kind: 'tear',
          }),
        );
      }
    }

    spawnBurst(80);
    for (let b = 1; b <= 6; b++) {
      setTimeout(() => spawnBurst(18), b * 240);
    }

    ensureLoop();
  }

  export function fireSparkles() {
    const colors = ['#FFD24A', '#E89817', '#FFFBE0'];
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);

    for (let i = 0; i < 20; i++) {
      particles.push(
        spawnParticle({
          x: rand(0.2, 0.8) * w,
          y: rand(0.4, 0.9) * h,
          vx: rand(-2, 2),
          vy: rand(-3, -1),
          g: -0.05,
          drag: 0.99,
          size: rand(4, 8),
          color: colors[Math.floor(Math.random() * colors.length)],
          maxLife: rand(90, 160),
          kind: 'circle',
        }),
      );
    }

    ensureLoop();
  }

  function drawStar(ctx: CanvasRenderingContext2D, r: number) {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const outer = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
      const inner = outer + Math.PI / 5;
      ctx.lineTo(Math.cos(outer) * r, Math.sin(outer) * r);
      ctx.lineTo(Math.cos(inner) * r * 0.45, Math.sin(inner) * r * 0.45);
    }
    ctx.closePath();
    ctx.fill();
  }

  function drawParticle(ctx: CanvasRenderingContext2D, p: Particle) {
    const alpha = p.life > p.maxLife * 0.7 ? 1 - (p.life - p.maxLife * 0.7) / (p.maxLife * 0.3) : 1;
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.fillStyle = p.color;

    if (p.kind === 'rect') {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    } else if (p.kind === 'circle') {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === 'star') {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      drawStar(ctx, p.size * 0.7);
      ctx.restore();
    } else if (p.kind === 'streamer') {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillRect(-p.size * 0.16, -p.size, p.size * 0.32, p.size * 2);
      ctx.restore();
    } else if (p.kind === 'spark') {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
      ctx.fill();
      // faint trailing glow
      ctx.globalAlpha = Math.max(0, alpha * 0.35);
      ctx.beginPath();
      ctx.arc(p.x - p.vx, p.y - p.vy, p.size / 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === 'ring') {
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.stroke();
    } else if (p.kind === 'emoji') {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.font = `${p.size * 2}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.glyph || '🎉', 0, 0);
      ctx.restore();
    } else if (p.kind === 'tear') {
      ctx.save();
      ctx.translate(p.x, p.y);
      const r = p.size / 2;
      ctx.beginPath();
      ctx.arc(0, r * 0.4, r * 0.75, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-r * 0.5, r * 0.4);
      ctx.quadraticCurveTo(0, -r * 1.2, r * 0.5, r * 0.4);
      ctx.fill();
      ctx.restore();
    }

    ctx.globalAlpha = 1;
  }

  function loop() {
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.vx *= p.drag;
      p.vy += p.g;
      p.vy *= p.drag;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      if (p.grow) p.size += p.grow;
      p.life++;

      if (p.life >= p.maxLife) {
        particles.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      drawParticle(ctx, p);
      ctx.restore();
    }

    if (particles.length > 0) {
      rafId = requestAnimationFrame(loop);
    } else {
      rafId = null;
    }
  }

  function ensureLoop() {
    if (!rafId) {
      rafId = requestAnimationFrame(loop);
    }
  }

  function resizeCanvas() {
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
  }

  $effect(() => {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    };
  });
</script>

<canvas
  bind:this={canvas}
  style="position:fixed;inset:0;pointer-events:none;z-index:9999;"
></canvas>

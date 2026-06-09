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
    kind: 'rect' | 'circle' | 'tear';
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

  export function fireConfetti(big: boolean) {
    const count = big ? 220 : 160;
    const colors = ['#E89817', '#FFD24A', '#E63946', '#6366F1', '#0F9D6E', '#FFFFFF'];
    const perEmitter = Math.floor(count / 3);

    // Left cannon
    launchCannon(0.12, -60, perEmitter, colors, 0.45, 0.22, 0.993, 8, 18, 180, 280, 'rect', 6, 12);
    // Right cannon
    launchCannon(0.88, -120, perEmitter, colors, 0.45, 0.22, 0.993, 8, 18, 180, 280, 'rect', 6, 12);
    // Top burst
    launchCannon(0.5, -90, count - perEmitter * 2, colors, 0.7, 0.22, 0.993, 6, 16, 180, 280, 'circle', 5, 10);

    ensureLoop();
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

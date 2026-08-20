const CONFETTI_Z_INDEX = 8998;
const DURATION_MS = 3200;
const DEFAULT_COLORS = ['#0014c8'];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  color: string;
  rotation: number;
  spin: number;
  shape: 'rect' | 'circle';
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function createParticles(count: number, width: number, height: number, colors: string[]): Particle[] {
  const pickColor = () => colors[Math.floor(Math.random() * colors.length)] ?? colors[0] ?? '#0014c8';

  return Array.from({ length: count }, () => ({
    x: randomBetween(width * 0.2, width * 0.8),
    y: randomBetween(height * 0.35, height * 0.55),
    vx: randomBetween(-4.5, 4.5),
    vy: randomBetween(-14, -6),
    w: randomBetween(6, 11),
    h: randomBetween(8, 16),
    color: pickColor(),
    rotation: randomBetween(0, Math.PI * 2),
    spin: randomBetween(-0.18, 0.18),
    shape: Math.random() > 0.35 ? 'rect' : 'circle',
  }));
}

export function fireCelebrationConfetti(colors: string[] = DEFAULT_COLORS): () => void {
  const palette = colors.length > 0 ? colors : DEFAULT_COLORS;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return () => undefined;
  }

  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.position = 'fixed';
  canvas.style.inset = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = String(CONFETTI_Z_INDEX);
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    canvas.remove();
    return () => undefined;
  }

  let width = window.innerWidth;
  let height = window.innerHeight;
  const dpr = window.devicePixelRatio || 1;

  const resize = () => {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  resize();

  let particles = createParticles(120, width, height, palette);
  const sideInterval = window.setInterval(() => {
    particles = particles.concat(createParticles(8, width, height, palette));
  }, 180);

  const startedAt = performance.now();
  let frameId = 0;

  const tick = (now: number) => {
    ctx.clearRect(0, 0, width, height);

    for (const particle of particles) {
      particle.vy += 0.28;
      particle.vx *= 0.992;
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.rotation += particle.spin;

      ctx.save();
      ctx.translate(particle.x, particle.y);
      ctx.rotate(particle.rotation);
      ctx.fillStyle = particle.color;

      if (particle.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(0, 0, particle.w * 0.45, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-particle.w * 0.5, -particle.h * 0.5, particle.w, particle.h);
      }

      ctx.restore();
    }

    particles = particles.filter(
      (particle) => particle.y < height + 40 && particle.x > -40 && particle.x < width + 40,
    );

    if (now - startedAt < DURATION_MS || particles.length > 0) {
      frameId = window.requestAnimationFrame(tick);
    } else {
      cleanup();
    }
  };

  const onResize = () => resize();
  window.addEventListener('resize', onResize);

  const cleanup = () => {
    window.cancelAnimationFrame(frameId);
    window.clearInterval(sideInterval);
    window.removeEventListener('resize', onResize);
    canvas.remove();
  };

  frameId = window.requestAnimationFrame(tick);

  return cleanup;
}

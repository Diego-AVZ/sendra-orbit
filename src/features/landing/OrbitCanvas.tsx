import { useEffect, useRef } from 'react';

type Star = { x: number; y: number; r: number; a: number; phase: number };

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rnd = mulberry32(202611);
const STARS: Star[] = Array.from({ length: 56 }, () => ({
  x: rnd(),
  y: rnd(),
  r: rnd() * 1.15 + 0.25,
  a: 0.18 + rnd() * 0.55,
  phase: rnd() * Math.PI * 2,
}));

const RINGS = [
  { rx: 0.4, ry: 0.16, tilt: -0.15, speed: 0.32, color: 'rgba(246, 215, 168, 0.95)' },
  { rx: 0.3, ry: 0.115, tilt: 0.55, speed: -0.48, color: 'rgba(61, 220, 151, 0.95)' },
  { rx: 0.18, ry: 0.18, tilt: 0, speed: 0.72, color: 'rgba(227, 164, 92, 1)' },
];

export function OrbitCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let live = true;

    const resize = () => {
      const { width, height } = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const paint = (time: number) => {
      const { width, height } = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, width, height);
      const cx = width / 2;
      const cy = height * 0.46;
      const s = Math.min(width, height);

      for (const star of STARS) {
        const twinkle = reduced ? 1 : 0.65 + Math.sin(time / 900 + star.phase) * 0.35;
        ctx.beginPath();
        ctx.fillStyle = `rgba(244, 239, 230, ${star.a * twinkle})`;
        ctx.arc(star.x * width, star.y * height, star.r, 0, Math.PI * 2);
        ctx.fill();
      }

      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, s * 0.22);
      glow.addColorStop(0, 'rgba(246, 215, 168, 0.9)');
      glow.addColorStop(0.28, 'rgba(227, 164, 92, 0.28)');
      glow.addColorStop(1, 'rgba(227, 164, 92, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, s * 0.22, 0, Math.PI * 2);
      ctx.fill();

      for (const ring of RINGS) {
        const rx = s * ring.rx;
        const ry = s * ring.ry;
        const angle = reduced ? 0.9 : (time / 1000) * ring.speed;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(ring.tilt);
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(244, 239, 230, 0.22)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, 0, angle - 0.85, angle);
        ctx.strokeStyle = ring.color;
        ctx.lineWidth = 1.6;
        ctx.stroke();

        for (let i = 10; i >= 0; i -= 1) {
          const a = angle - i * 0.045;
          const x = Math.cos(a) * rx;
          const y = Math.sin(a) * ry;
          ctx.beginPath();
          ctx.fillStyle = ring.color.replace(/[\d.]+\)$/, `${(1 - i / 12) * 0.85})`);
          ctx.arc(x, y, i === 0 ? 3.4 : 1.6, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      ctx.beginPath();
      ctx.fillStyle = '#f6e7c8';
      ctx.arc(cx, cy, Math.max(10, s * 0.034), 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(227, 164, 92, 0.9)';
      ctx.lineWidth = 1;
      ctx.arc(cx, cy, Math.max(14, s * 0.048), 0, Math.PI * 2);
      ctx.stroke();
    };

    const loop = (time: number) => {
      paint(time);
      if (live && !reduced && !document.hidden) raf = requestAnimationFrame(loop);
    };

    const onResize = () => {
      resize();
      paint(performance.now());
    };

    const onVisibility = () => {
      if (!document.hidden && live && !reduced) {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(loop);
      }
    };

    resize();
    raf = requestAnimationFrame(loop);
    const observer = new ResizeObserver(onResize);
    observer.observe(canvas);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      live = false;
      cancelAnimationFrame(raf);
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return <canvas ref={ref} className="absolute inset-0 h-full w-full" aria-hidden />;
}

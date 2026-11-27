import { useEffect, useRef } from 'react';

export function HorizonLines() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let live = true;
    let seen = true;

    const resize = () => {
      const { width, height } = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const paint = (time: number) => {
      const { width, height } = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, width, height);
      if (width < 2 || height < 2) return;

      const narrow = width < 800;
      const vx = width * (narrow ? 1.02 : 0.9);
      const vy = height * (narrow ? 0.28 : 0.4);
      const focal = Math.max(width, height) * 0.92;
      const yPlane = -0.62;
      const zNear = 0.42;
      const zFar = 8.5;
      const cols = narrow ? 11 : 15;
      const bays = narrow ? 6 : 8;
      const travel = reduced ? 0.4 : (time / 14000) % 1;
      const sway = reduced ? 0 : Math.sin(time / 9000) * 0.22;

      const project = (x: number, z: number) => ({
        x: vx + ((x + sway) / z) * focal,
        y: vy + (yPlane / z) * focal,
      });

      const fade = (x: number, y: number, z: number) => {
        const depth = Math.min(1, Math.max(0, (z - zNear) / 1.6)) * (1 - Math.min(1, (z - 1) / zFar));
        const left = Math.min(1, Math.max(0, (x / width - 0.02) / (narrow ? 0.2 : 0.1)));
        const band =
          Math.min(1, Math.max(0, (y / height + 0.02) / 0.04)) *
          Math.min(1, Math.max(0, (0.94 - y / height) / 0.2));
        return depth * left * band;
      };

      const stroke = (x0: number, z0: number, x1: number, z1: number, color: string, gain: number) => {
        if (z0 < 0.35 || z1 < 0.35) return;
        const a = project(x0, z0);
        const b = project(x1, z1);
        const alpha = fade((a.x + b.x) / 2, (a.y + b.y) / 2, (z0 + z1) / 2) * gain;
        if (alpha < 0.015) return;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = color.replace('A', Math.min(0.62, alpha).toFixed(3));
        ctx.stroke();
      };

      ctx.lineWidth = 1;

      for (let i = 0; i <= cols; i += 1) {
        const x = -9.4 + (i / cols) * 12.6;
        const green = i % 6 === 0;
        const parts = 6;
        for (let p = 0; p < parts; p += 1) {
          const z0 = zNear + ((zFar - zNear) * p) / parts;
          const z1 = zNear + ((zFar - zNear) * (p + 1)) / parts;
          stroke(
            x,
            z0,
            x,
            z1,
            green ? 'rgba(61, 220, 151, A)' : 'rgba(220, 232, 224, A)',
            green ? 0.95 : 0.72,
          );
        }
      }

      for (let i = 0; i < bays; i += 1) {
        const z = zNear + (((i + travel) % bays) / bays) * (zFar - zNear);
        const steps = 7;
        const span = 10.2;
        for (let s = 0; s < steps; s += 1) {
          const x0 = -span + (span * 1.35 * s) / steps;
          const x1 = -span + (span * 1.35 * (s + 1)) / steps;
          stroke(x0, z, x1, z, 'rgba(198, 220, 208, A)', 0.28);
        }
      }
    };

    const loop = (time: number) => {
      if (!live) return;
      if (seen && !document.hidden) paint(time);
      if (!reduced) raf = requestAnimationFrame(loop);
    };

    resize();
    raf = requestAnimationFrame(loop);
    const observer = new ResizeObserver(() => {
      resize();
      paint(performance.now());
    });
    observer.observe(canvas);
    const visibility = new IntersectionObserver(([entry]) => {
      seen = entry.isIntersecting;
    });
    visibility.observe(canvas);
    const onHide = () => {
      if (!document.hidden && live && !reduced) {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(loop);
      }
    };
    document.addEventListener('visibilitychange', onHide);

    return () => {
      live = false;
      cancelAnimationFrame(raf);
      observer.disconnect();
      visibility.disconnect();
      document.removeEventListener('visibilitychange', onHide);
    };
  }, []);

  return <canvas ref={ref} className="land-lines" aria-hidden="true" />;
}

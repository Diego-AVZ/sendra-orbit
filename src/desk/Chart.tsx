import { useMemo, useState, type MouseEvent } from 'react';
import type { Candle } from '@/engine/candles';
import { price } from './format';

function stamp(time: number): string {
  return new Date(time * 1000).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function PriceChart({ candles }: { candles: Candle[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const data = useMemo(() => candles.filter((candle) => candle.close > 0 && candle.high >= candle.low), [candles]);
  if (data.length < 2) {
    return <div className="ob-chart ob-chart-empty">Waiting for price history</div>;
  }
  const lo = Math.min(...data.map((candle) => candle.low));
  const hi = Math.max(...data.map((candle) => candle.high));
  const span = hi - lo || 1;
  const pad = span * 0.06;
  const min = lo - pad;
  const max = hi + pad;
  const width = data.length;
  const height = 100;
  const y = (value: number) => ((max - value) / (max - min)) * (height - 8) + 4;
  const active = hover != null ? data[hover] : data[data.length - 1];
  const move = (event: MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const index = Math.round(((event.clientX - rect.left) / rect.width) * (data.length - 1));
    setHover(Math.max(0, Math.min(data.length - 1, index)));
  };
  return (
    <div className="ob-plot">
      <svg
        className="ob-chart"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="Price chart"
        onMouseMove={move}
        onMouseLeave={() => setHover(null)}
      >
        {[0.25, 0.5, 0.75].map((level) => (
          <line key={level} x1="0" x2={width} y1={height * level} y2={height * level} stroke="#2a2a2a" strokeWidth="0.15" />
        ))}
        {data.map((candle, index) => {
          const up = candle.close >= candle.open;
          const color = up ? 'var(--up)' : 'var(--down)';
          const bodyTop = y(Math.max(candle.open, candle.close));
          const body = Math.max(0.35, Math.abs(y(candle.open) - y(candle.close)));
          return (
            <g key={`${candle.time}-${index}`}>
              <line x1={index + 0.5} x2={index + 0.5} y1={y(candle.high)} y2={y(candle.low)} stroke={color} strokeWidth="0.12" />
              <rect x={index + 0.18} y={bodyTop} width="0.64" height={body} fill={color} />
            </g>
          );
        })}
        <line x1="0" x2={width} y1={y(active.close)} y2={y(active.close)} stroke="#f2f2f2" strokeWidth="0.12" strokeDasharray="0.4 0.35" opacity="0.7" />
        {hover != null && <line x1={hover + 0.5} x2={hover + 0.5} y1="0" y2={height} stroke="#808080" strokeWidth="0.08" />}
      </svg>
      <div className="ob-readout">
        <b className="ob-mono">${price(active.close)}</b>
        <span>{stamp(active.time)}</span>
        <span>O {price(active.open)}</span>
        <span>H {price(active.high)}</span>
        <span>L {price(active.low)}</span>
      </div>
      <div className="ob-axis">
        <span>{stamp(data[0].time)}</span>
        <span className="ob-mono">{price(hi)} – {price(lo)}</span>
        <span>{stamp(data[data.length - 1].time)}</span>
      </div>
    </div>
  );
}

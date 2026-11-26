import { useMemo, useState } from 'react';
import type { Candle } from '@/engine/candles';
import { price } from './format';
import { Token } from './Token';

const WINDOWS = [10, 15, 30, 60, 100, 200] as const;
type Mode = 'price' | 'candles';

function windowPct(value: number): string {
  const body = `${Math.abs(value).toFixed(1)}%`;
  if (value > 0) return `+${body}`;
  if (value < 0) return `−${body}`;
  return body;
}

function dayLabel(time: number): string {
  return new Date(time * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function RangeBoard({
  candles,
  spot,
  min,
  max,
  days,
  onDays,
  base,
  quote,
  unit,
}: {
  candles: Candle[];
  spot: number;
  min: number;
  max: number;
  days: number;
  onDays: (days: number) => void;
  base: string;
  quote: string;
  unit: string;
}) {
  const [mode, setMode] = useState<Mode>('price');
  const shown = useMemo(() => {
    const cut = Math.floor(Date.now() / 1000) - days * 86_400;
    const rows = candles.filter((candle) => candle.time >= cut && candle.close > 0);
    return rows.length > 1 ? rows : candles.filter((candle) => candle.close > 0);
  }, [candles, days]);
  const domain = useMemo(() => {
    const values = shown.flatMap((candle) => [candle.low, candle.high, candle.close]).filter((value) => value > 0);
    if (spot > 0) values.push(spot);
    if (!values.length) return { min: 0, max: 1 };
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    const pad = (hi - lo) * 0.12 || spot * 0.04 || 1;
    return { min: Math.max(0, lo - pad), max: hi + pad };
  }, [shown, spot]);
  const first = shown[0]?.close ?? 0;
  const last = shown[shown.length - 1]?.close ?? 0;
  const change = first > 0 && last > 0 ? (last / first - 1) * 100 : null;
  const width = 640;
  const height = 220;
  const yOf = (value: number) => {
    const span = domain.max - domain.min || 1;
    return ((domain.max - value) / span) * (height - 8) + 4;
  };
  const ticks = [domain.max, domain.max * 0.67 + domain.min * 0.33, domain.max * 0.33 + domain.min * 0.67, domain.min];
  const dates = shown.length > 1
    ? [shown[0], shown[Math.floor(shown.length / 2)], shown[shown.length - 1]]
    : [];

  return (
    <section className="ob-liq-chart" aria-label="Pool price">
      <div className="ob-liq-chart-head">
        <div>
          <p className="ob-liq-pairname">
            <Token symbol={base} size={18} />
            <Token symbol={quote} size={18} />
            <span>{base}/{quote}</span>
          </p>
          <p className="ob-liq-px">
            <b className="ob-mono">{spot > 0 ? price(spot) : '—'}</b>
            <span>{unit}</span>
          </p>
          {mode === 'price' && change != null && (
            <p className={change < 0 ? 'down' : change > 0 ? 'up' : 'flat'}>
              {windowPct(change)} in {days} d
            </p>
          )}
        </div>
        <div className="ob-liq-chart-tools">
          <div className="ob-seg cols-2" role="radiogroup" aria-label="Chart type">
            {(['price', 'candles'] as const).map((item) => (
              <button key={item} type="button" className={mode === item ? 'is-on' : ''} onClick={() => setMode(item)}>
                {item === 'price' ? 'Price' : 'Candles'}
              </button>
            ))}
          </div>
          <div className="ob-liq-windows" role="radiogroup" aria-label="Chart window">
            {WINDOWS.map((item) => (
              <button key={item} type="button" className={days === item ? 'is-on' : ''} onClick={() => onDays(item)}>{item}d</button>
            ))}
          </div>
        </div>
      </div>
      {shown.length > 1 ? (
        <>
          <div className="ob-liq-stage">
            <div className="ob-liq-ys">
              {ticks.map((tick) => <span key={tick} className="ob-mono">{price(tick)}</span>)}
            </div>
            <svg className="ob-chart" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label={mode === 'price' ? 'Price' : 'Candles'}>
              {[0.25, 0.5, 0.75].map((level) => (
                <line key={level} x1="0" x2={width} y1={height * level} y2={height * level} stroke="#2a2a2a" strokeWidth="1" />
              ))}
              {mode === 'price' ? <Line candles={shown} yOf={yOf} width={width} height={height} /> : <Candles candles={shown} yOf={yOf} width={width} />}
              {min > 0 && max > min && (
                <>
                  <line x1="0" x2={width} y1={yOf(max)} y2={yOf(max)} stroke="#6a6a6a" strokeDasharray="4 4" />
                  <line x1="0" x2={width} y1={yOf(min)} y2={yOf(min)} stroke="#6a6a6a" strokeDasharray="4 4" />
                </>
              )}
              {spot > 0 && <line x1="0" x2={width} y1={yOf(spot)} y2={yOf(spot)} stroke="#d0d0d0" strokeDasharray="3 4" strokeOpacity="0.7" />}
            </svg>
          </div>
          <div className="ob-liq-xs">
            {dates.map((candle) => <span key={candle.time}>{dayLabel(candle.time)}</span>)}
          </div>
        </>
      ) : (
        <div className="ob-chart-empty ob-liq-wait">{spot > 0 ? 'Price history is still loading.' : 'Reading the pool…'}</div>
      )}
    </section>
  );
}

function Line({ candles, yOf, width, height }: { candles: Candle[]; yOf: (value: number) => number; width: number; height: number }) {
  const points = candles.map((candle, index) => `${(index / Math.max(1, candles.length - 1)) * width},${yOf(candle.close)}`).join(' ');
  const area = `0,${height} ${points} ${width},${height}`;
  return (
    <>
      <polygon points={area} fill="#8a8a8a" opacity="0.08" />
      <polyline points={points} fill="none" stroke="#9a9a9a" strokeWidth="1.6" />
    </>
  );
}

function Candles({ candles, yOf, width }: { candles: Candle[]; yOf: (value: number) => number; width: number }) {
  const slot = width / candles.length;
  return (
    <>
      {candles.map((candle, index) => {
        const x = index * slot + slot / 2;
        const up = candle.close >= candle.open;
        const color = up ? 'var(--up)' : 'var(--down)';
        const top = yOf(Math.max(candle.open, candle.close));
        const body = Math.max(1, Math.abs(yOf(candle.open) - yOf(candle.close)));
        return (
          <g key={`${candle.time}-${index}`}>
            <line x1={x} x2={x} y1={yOf(candle.high)} y2={yOf(candle.low)} stroke={color} strokeWidth="1" />
            <rect x={x - Math.max(1, slot * 0.28)} y={top} width={Math.max(1.2, slot * 0.56)} height={body} fill={color} />
          </g>
        );
      })}
    </>
  );
}

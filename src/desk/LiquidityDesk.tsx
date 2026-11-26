import { useEffect, useMemo, useRef, useState } from 'react';
import type { Candle } from '@/engine/candles';
import type { LabsStat } from '@/engine/market';
import { Positions } from './Positions';
import { RangeBoard } from './RangeBoard';
import { useBook } from './book';
import { aprText, feeLabel, price, usd, usdcRaw } from './format';
import { POOLS, budgetFromUsdc, coinOf, priceBand, rangeTicks, type Pool, type RangeMode, type Risk, type Strategy } from './markets';
import { useLabsStats, usePoolQuote } from './quotes';
import { Token } from './Token';

const BIAS: Strategy[] = ['bullish', 'neutral', 'bearish'];
const RISKS: Risk[] = ['low', 'medium', 'high'];
const SLIP = [0.5, 1, 2] as const;

function compactUsd(value: number): string {
  if (!(value > 0)) return '—';
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
  return usd(value, 0);
}

function factorOf(min: number, max: number): number | null {
  if (!(min > 0) || !(max > min)) return null;
  const ratio = (min / max) ** 0.25;
  if (!(ratio < 1)) return null;
  return 1 / (1 - ratio);
}

function movesOf(candles: Candle[]): { yearly: number; daily: number; weekly: number } | null {
  const cut = Math.floor(Date.now() / 1000) - 7 * 86_400;
  const rows = candles.filter((candle) => candle.time >= cut && candle.close > 0);
  if (rows.length < 12) return null;
  const returns: number[] = [];
  for (let index = 1; index < rows.length; index += 1) {
    if (rows[index - 1].close > 0) returns.push(Math.log(rows[index].close / rows[index - 1].close));
  }
  if (returns.length < 8) return null;
  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance = returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (returns.length - 1);
  const hourly = Math.sqrt(variance);
  const yearly = hourly * Math.sqrt(24 * 365);
  return { yearly, daily: yearly / Math.sqrt(365), weekly: yearly / Math.sqrt(52) };
}

function daysInside(candles: Candle[], min: number, max: number, span: number): { inside: number; total: number } | null {
  const cut = Math.floor(Date.now() / 1000) - span * 86_400;
  const last = new Map<number, number>();
  for (const candle of candles) {
    if (candle.time < cut || !(candle.close > 0)) continue;
    last.set(Math.floor(candle.time / 86_400), candle.close);
  }
  if (!last.size) return null;
  let inside = 0;
  for (const close of last.values()) {
    if (close >= min && close < max) inside += 1;
  }
  return { inside, total: last.size };
}

export function LiquidityDesk() {
  const book = useBook();
  const [poolId, setPoolId] = useState(POOLS[0].id);
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState<RangeMode>('custom');
  const [strategy, setStrategy] = useState<Strategy>('neutral');
  const [risk, setRisk] = useState<Risk>('medium');
  const [lowPct, setLowPct] = useState('10');
  const [highPct, setHighPct] = useState('10');
  const [days, setDays] = useState(100);
  const [slip, setSlip] = useState<(typeof SLIP)[number]>(0.5);
  const [poolsOpen, setPoolsOpen] = useState(false);
  const poolsRef = useRef<HTMLDivElement>(null);
  const { stats, failed } = useLabsStats();
  useEffect(() => {
    if (!poolsOpen) return;
    const onPointer = (event: MouseEvent) => {
      if (!poolsRef.current?.contains(event.target as Node)) setPoolsOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPoolsOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [poolsOpen]);
  const catalog = useMemo(() => {
    if (!stats) return failed ? POOLS.map((pool) => ({ ...pool, stat: null as LabsStat | null })) : [];
    const byPool = new Map(stats.map((stat) => [stat.pool, stat]));
    return POOLS.flatMap((pool) => {
      const stat = byPool.get(pool.pool.toLowerCase());
      return stat ? [{ ...pool, stat }] : [];
    }).sort((a, b) => (b.stat.fullRangeApr ?? -1) - (a.stat.fullRangeApr ?? -1));
  }, [failed, stats]);
  const pool: Pool & { stat?: LabsStat | null } = catalog.find((item) => item.id === poolId) ?? catalog[0] ?? POOLS[0];
  const { quote, hourly, daily, error } = usePoolQuote(pool);
  const spot = quote?.price ?? 0;
  const series = days <= 30 ? hourly : daily;
  const band = priceBand(spot, mode, strategy, risk, lowPct, highPct, true);
  const ticks = quote && band.min > 0 && band.max > band.min
    ? rangeTicks(band.min, band.max, pool.token0.decimals, pool.token1.decimals, pool.feePips)
    : null;
  const base = coinOf(pool.token0.symbol);
  const quoteCoin = coinOf(pool.token1.symbol);
  const numeric = Number(amount);
  const lowNum = Number(lowPct);
  const highNum = Number(highPct);
  const moves = useMemo(() => movesOf(hourly), [hourly]);
  const inside = useMemo(
    () => (band.min > 0 && band.max > band.min ? daysInside(series, band.min, band.max, days) : null),
    [band.max, band.min, days, series],
  );
  const factor = factorOf(band.min, band.max);
  const fullApr = pool.stat?.fullRangeApr ?? null;
  const inRangeApr = fullApr != null && factor != null ? fullApr * factor : null;
  const expectedApr = inRangeApr != null && inside && inside.total > 0 ? inRangeApr * (inside.inside / inside.total) : null;
  const blocker = !book.ready
    ? 'Loading the account…'
    : !(numeric > 0) ? 'Enter an amount'
      : numeric > book.cashUsd ? 'Not enough paper USDC'
        : !quote ? (error ?? 'Reading the pool…')
          : !(quote.price1Usd > 0) ? 'Oracle price unavailable'
            : !ticks ? 'The range is not on a tick yet'
              : null;

  const setBound = (which: 'low' | 'high', value: string) => {
    setMode('custom');
    const cleaned = value.replace(/[^0-9.]/g, '');
    if (which === 'low') setLowPct(cleaned);
    else setHighPct(cleaned);
  };

  const submit = () => {
    if (!quote || !ticks || blocker || book.pending) return;
    const budgetToken1 = budgetFromUsdc(usdcRaw(numeric), pool.token1.decimals, quote.price1Usd, pool.token1.symbol === 'USDC' || pool.token1.symbol === 'USDT');
    void book.openLp({
      pool: pool.pool,
      token0: pool.token0.address,
      token1: pool.token1.address,
      decimals0: pool.token0.decimals,
      decimals1: pool.token1.decimals,
      feePips: pool.feePips,
      tickLower: ticks.tickLower,
      tickUpper: ticks.tickUpper,
      budgetToken1,
      price0Usd: quote.price0Usd,
      price1Usd: quote.price1Usd,
    }, numeric);
  };

  const spotShare = Number.isFinite(lowNum) && Number.isFinite(highNum) && lowNum + highNum > 0
    ? (lowNum / (lowNum + highNum)) * 100
    : 50;
  const poolRows = catalog.length ? catalog : [pool];

  return (
    <div className="ob-liq">
      <header className="ob-liq-top">
        <div>
          <p className="ob-liq-kicker">Provide liquidity</p>
          <div className="ob-liq-pair" ref={poolsRef}>
            <button
              type="button"
              className="ob-liq-pick"
              aria-label="Pool"
              aria-haspopup="listbox"
              aria-expanded={poolsOpen}
              onClick={() => setPoolsOpen((open) => !open)}
            >
              <span className="ob-liq-coins">
                <Token symbol={base} size={28} />
                <Token symbol={quoteCoin} size={28} />
              </span>
              <span>{pool.label}</span>
              <svg viewBox="0 0 12 12" width="14" height="14" aria-hidden="true"><path d="M2.2 4.2 6 8l3.8-3.8" /></svg>
            </button>
            {poolsOpen && (
              <ul className="ob-liq-menu" role="listbox" aria-label="Pools">
                {poolRows.map((item) => (
                  <li key={item.id} role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={item.id === pool.id}
                      className={item.id === pool.id ? 'is-on' : ''}
                      onClick={() => {
                        setPoolId(item.id);
                        setPoolsOpen(false);
                      }}
                    >
                      <span className="ob-liq-coins">
                        <Token symbol={coinOf(item.token0.symbol)} size={22} />
                        <Token symbol={coinOf(item.token1.symbol)} size={22} />
                      </span>
                      <span>{item.label}</span>
                      {item.stat?.fullRangeApr != null && <small>{aprText(item.stat.fullRangeApr)}</small>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <dl className="ob-liq-stats">
          <div>
            <dt>Full range APR</dt>
            <dd className={fullApr != null && fullApr > 0 ? 'up' : ''}>{aprText(fullApr)}</dd>
          </div>
          <div>
            <dt>Fee tier</dt>
            <dd>{feeLabel(pool.feePips)}</dd>
          </div>
          <div>
            <dt>TVL</dt>
            <dd>{pool.stat ? compactUsd(pool.stat.tvlUsd) : '—'}</dd>
          </div>
          <div>
            <dt>Price</dt>
            <dd>{spot > 0 ? price(spot) : '—'} <small>{quoteCoin}</small></dd>
            <small>per {base}</small>
          </div>
        </dl>
      </header>
      <div className="ob-liq-grid">
        <div className="ob-liq-main">
          <RangeBoard
            candles={series}
            spot={spot}
            min={band.min}
            max={band.max}
            days={days}
            onDays={setDays}
            base={base}
            quote={quoteCoin}
            unit={quoteCoin}
          />
          <section className="ob-liq-moves" aria-label="How this pair moves">
            <p>How this pair moves · last 7 days</p>
            <dl>
              <div>
                <dt>Volatility, yearly</dt>
                <dd className="ob-mono">{moves ? `${(moves.yearly * 100).toFixed(1)}%` : '—'}</dd>
              </div>
              <div>
                <dt>Typical daily move</dt>
                <dd className="ob-mono">{moves ? `±${(moves.daily * 100).toFixed(2)}%` : '—'}</dd>
              </div>
              <div>
                <dt>Typical weekly move</dt>
                <dd className="ob-mono">{moves ? `±${(moves.weekly * 100).toFixed(1)}%` : '—'}</dd>
              </div>
            </dl>
          </section>
          <Positions kinds={[2]} heading="Open positions" empty="No open Uniswap positions yet. Set a range and an amount to open one." />
        </div>
        <aside className="ob-liq-side">
          <h2>Price range</h2>
          <p className="ob-copy">Your position earns fees only while the price stays inside it. Narrower earns more, but leaves the range sooner.</p>
          <div className="ob-seg cols-2" role="radiogroup" aria-label="Range mode">
            <button type="button" className={mode === 'custom' ? 'is-on' : ''} onClick={() => setMode('custom')}>Set manually</button>
            <button type="button" className={mode === 'preset' ? 'is-on' : ''} onClick={() => setMode('preset')}>Preset</button>
          </div>
          {mode === 'preset' ? (
            <>
              <div className="ob-seg cols-3" role="radiogroup" aria-label="Bias">
                {BIAS.map((item) => (
                  <button key={item} type="button" className={strategy === item ? 'is-on' : ''} onClick={() => setStrategy(item)}>
                    {item[0].toUpperCase() + item.slice(1)}
                  </button>
                ))}
              </div>
              <div className="ob-seg cols-3" role="radiogroup" aria-label="Risk">
                {RISKS.map((item) => (
                  <button key={item} type="button" className={risk === item ? 'is-on' : ''} onClick={() => setRisk(item)}>
                    {item[0].toUpperCase() + item.slice(1)}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="ob-limits">
              <label>
                Below
                <span>
                  <input value={lowPct} inputMode="decimal" aria-label="Percent below" onChange={(event) => setBound('low', event.target.value)} />
                  <em>%</em>
                </span>
                <input type="range" min="1" max="80" step="1" value={Number.isFinite(lowNum) && lowNum > 0 ? Math.min(80, lowNum) : 10} onChange={(event) => setBound('low', event.target.value)} />
              </label>
              <label>
                Above
                <span>
                  <input value={highPct} inputMode="decimal" aria-label="Percent above" onChange={(event) => setBound('high', event.target.value)} />
                  <em>%</em>
                </span>
                <input type="range" min="1" max="80" step="1" value={Number.isFinite(highNum) && highNum > 0 ? Math.min(80, highNum) : 10} onChange={(event) => setBound('high', event.target.value)} />
              </label>
            </div>
          )}
          {spot > 0 && band.max > band.min && (
            <div className="ob-trackbox">
              <div className="ob-trackline" aria-hidden="true">
                <i />
                <b style={{ left: `${spotShare}%` }} />
              </div>
              <div className="ob-tracknums ob-mono">
                <span>{price(band.min)}</span>
                <span>{price(spot)}</span>
                <span>{price(band.max)} {quoteCoin}</span>
              </div>
            </div>
          )}
          <p className="ob-label">Estimated fees</p>
          <dl className="ob-fees">
            <div>
              <dt>APR while in range</dt>
              <dd className="ob-mono">{inRangeApr != null ? `≈ ${aprText(inRangeApr)}` : '—'}</dd>
              {factor != null && fullApr != null && <small>{factor.toFixed(1)}× full range ({aprText(fullApr)})</small>}
            </div>
            <div>
              <dt>Time in range</dt>
              <dd className="ob-mono">{inside && inside.total > 0 ? `${Math.round((inside.inside / inside.total) * 100)}%` : '—'}</dd>
              {inside && <small>{inside.inside} of the last {inside.total} days</small>}
            </div>
            <div>
              <dt>Expected APR</dt>
              <dd className="ob-mono">{expectedApr != null ? `≈ ${aprText(expectedApr)}` : '—'}</dd>
            </div>
          </dl>
          <div className="ob-field">
            <span>
              USDC amount
              <button type="button" className="ob-text" onClick={() => setAmount((Math.floor(book.cashUsd * 100) / 100).toString())}>
                Balance {usd(book.cashUsd)}
              </button>
            </span>
          </div>
          <div className="ob-amount">
            <span>$</span>
            <input value={amount} inputMode="decimal" aria-label="USDC amount" placeholder="0" onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, ''))} />
          </div>
          <div className="ob-slip">
            <span>Slippage</span>
            <div role="radiogroup" aria-label="Slippage">
              {SLIP.map((pct) => (
                <button key={pct} type="button" className={slip === pct ? 'is-on' : ''} onClick={() => setSlip(pct)}>{pct}%</button>
              ))}
            </div>
          </div>
          {blocker && blocker !== 'Enter an amount' && <p className="ob-status">{blocker}</p>}
          <button type="button" className="ob-btn" disabled={!!blocker || book.pending} onClick={submit}>
            {book.pending ? 'Working…' : blocker === 'Enter an amount' ? 'Enter an amount' : 'Provide liquidity'}
          </button>
        </aside>
      </div>
    </div>
  );
}

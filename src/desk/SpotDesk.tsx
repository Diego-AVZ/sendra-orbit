import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { PaperPosition } from '@/engine';
import { TvChart } from './TvChart';
import { Positions } from './Positions';
import { principalOf, useBook } from './book';
import { changeOver, price, signedPct, signedUsd, tone, usd } from './format';
import { coinOf, SPOT } from './markets';
import { useAssetQuote, type BarInterval } from './quotes';
import { Token } from './Token';

const INTERVALS: BarInterval[] = ['15m', '1h', '4h', '1d'];

function spotAmount(position: PaperPosition): string {
  const snap = position.snapshot as { tokens?: bigint; decimals?: number };
  if (typeof snap.tokens !== 'bigint') return '—';
  const value = Number(snap.tokens) / 10 ** (snap.decimals ?? 8);
  if (!Number.isFinite(value)) return '—';
  return value.toLocaleString('en-US', { maximumFractionDigits: 6 });
}

export function SpotDesk() {
  const book = useBook();
  const [params] = useSearchParams();
  const query = params.get('coin');
  const [coin, setCoin] = useState(() => (SPOT.some((market) => market.coin === query) ? query! : 'BTC'));
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('100');
  const [interval, setInterval] = useState<BarInterval>('1h');
  const [sellId, setSellId] = useState<string | null>(null);
  const market = SPOT.find((item) => item.coin === coin) ?? SPOT[0];
  const quote = useAssetQuote(market.asset, interval);
  const held = book.positions.filter((position) => (
    position.kind === 4 && position.status === 'open' && position.params.symbol === market.asset.symbol
  ));
  const selected = held.find((position) => position.id === sellId) ?? held[0] ?? null;
  const heldEquity = held.reduce((sum, position) => sum + (position.mark?.equityUsd ?? principalOf(position)), 0);
  const change = useMemo(() => changeOver(quote.candles, 86_400), [quote.candles]);
  const numeric = Number(amount);
  const fill = quote.price ?? quote.candles.at(-1)?.close ?? null;
  const blocker = !book.ready
    ? 'Loading the account…'
    : side === 'sell'
      ? selected == null ? `No open ${coin}` : null
      : !(numeric > 0) ? 'Enter an amount'
        : numeric > book.cashUsd ? 'Not enough paper USDC'
          : fill == null ? (quote.error ?? 'Waiting for a price…') : null;

  useEffect(() => {
    if (query && SPOT.some((item) => item.coin === query)) setCoin(query);
  }, [query]);

  const submit = () => {
    if (blocker || book.pending) return;
    if (side === 'sell') {
      if (selected) void book.close(selected.id);
      return;
    }
    if (fill == null) return;
    void book.openSpot(market.asset, numeric, quote.price ?? fill);
  };

  return (
    <div className="ob-terminal">
      <header className="ob-bar">
        <div className="ob-coins" role="radiogroup" aria-label="Spot markets">
          {SPOT.map((item) => (
            <button key={item.coin} type="button" className={item.coin === coin ? 'is-on' : ''} onClick={() => setCoin(item.coin)}>
              <Token symbol={item.coin} size={16} />
              {item.coin}
            </button>
          ))}
        </div>
        <div className="ob-seg cols-4" role="radiogroup" aria-label="Timeframe">
          {INTERVALS.map((item) => (
            <button key={item} type="button" className={interval === item ? 'is-on' : ''} onClick={() => setInterval(item)}>{item}</button>
          ))}
        </div>
        <div className="ob-px">
          <b className="ob-mono">{fill != null ? `$${price(fill)}` : '—'}</b>
          {change != null && <span className={tone(change)}>{signedPct(change)} 24h</span>}
        </div>
      </header>
      <div className="ob-split">
        <div className="ob-chartbox">
          <TvChart key={coin} coin={coin} interval={interval} />
        </div>
        <aside className="ob-ticket">
          <div className="ob-balances">
            <div>
              <span>Cash</span>
              <b className="ob-mono">{usd(book.cashUsd)}</b>
            </div>
            <div>
              <span>Open {coin}</span>
              <b className="ob-mono">{held.length ? usd(heldEquity) : '—'}</b>
            </div>
          </div>
          <div className="ob-form">
            <div className="ob-seg cols-2" role="radiogroup" aria-label="Side">
              {(['buy', 'sell'] as const).map((next) => (
                <button key={next} type="button" className={side === next ? 'is-on' : ''} onClick={() => setSide(next)}>
                  {next === 'buy' ? 'Buy' : 'Sell'}
                </button>
              ))}
            </div>
            {side === 'buy' ? (
              <>
                <p className="ob-copy">Pay paper USDC, receive {coin}. Filled at the oracle, 0.30% fee.</p>
                <div className="ob-field">
                  <span>
                    Amount USDC
                    <button type="button" className="ob-text" onClick={() => setAmount((Math.floor(book.cashUsd * 100) / 100).toString())}>
                      {usd(book.cashUsd)} available
                    </button>
                  </span>
                </div>
                <div className="ob-amount">
                  <span>$</span>
                  <input value={amount} inputMode="decimal" aria-label="Amount USDC" placeholder="0" onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, ''))} />
                </div>
                <div className="ob-chips">
                  {[25, 50, 75, 100].map((pct) => (
                    <button key={pct} type="button" className="ob-chip" onClick={() => setAmount((Math.floor(book.cashUsd * pct) / 100).toString())}>{pct}%</button>
                  ))}
                </div>
                {fill != null && numeric > 0 && (
                  <p className="ob-copy">About {(numeric / fill).toLocaleString('en-US', { maximumFractionDigits: 6 })} {coin} before the fee.</p>
                )}
              </>
            ) : (
              <>
                <p className="ob-copy">Sell closes the whole position at the current oracle.</p>
                {held.length === 0 && <p className="ob-empty">No open {coin}.</p>}
                <div className="ob-picks">
                  {held.map((position) => {
                    const pnl = position.mark?.pnlUsd ?? 0;
                    const on = selected?.id === position.id;
                    return (
                      <button key={position.id} type="button" className={on ? 'is-on' : ''} onClick={() => setSellId(position.id)}>
                        <b>{spotAmount(position)} {coinOf(market.asset.symbol)}</b>
                        <span className={tone(pnl)}>{signedUsd(pnl)}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
            {blocker && <p className="ob-status">{blocker}</p>}
            <button type="button" className="ob-btn" disabled={!!blocker || book.pending} onClick={submit}>
              {book.pending ? 'Working…' : side === 'buy' ? `Buy ${coin}` : `Sell ${coin}`}
            </button>
          </div>
          <Positions kinds={[4]} empty="No spot positions yet." />
        </aside>
      </div>
    </div>
  );
}

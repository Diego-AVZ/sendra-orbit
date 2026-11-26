import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { EvalAccount } from '@/engine/accounts';
import { USDC } from '@/engine/assets';
import { readReserve } from '@/engine/chain';
import { assetPriceUsd } from '@/engine/market';
import { aprText, feeLabel, signedUsd, tone, usd } from './format';
import { POOLS, SPOT } from './markets';
import { Positions } from './Positions';
import { Token } from './Token';
import { useBook } from './book';
import { useLabsStats } from './quotes';

type Quote = { coin: string; price: number | null; supplyApr: number | null };

export function Overview() {
  const book = useBook();
  const { stats } = useLabsStats();
  const topPools = useMemo(() => {
    if (!stats) return [];
    const byPool = new Map(stats.map((stat) => [stat.pool, stat]));
    return POOLS.flatMap((pool) => {
      const stat = byPool.get(pool.pool.toLowerCase());
      return stat ? [{ pool, stat }] : [];
    }).sort((a, b) => (b.stat.fullRangeApr ?? -1) - (a.stat.fullRangeApr ?? -1)).slice(0, 3);
  }, [stats]);
  const [quotes, setQuotes] = useState<Quote[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const open = book.positions.filter((position) => position.status === 'open').length;
  const closed = book.positions.filter((position) => position.status === 'closed').length;

  useEffect(() => {
    let cancel = false;
    Promise.all([{ coin: 'USDC', asset: USDC }, ...SPOT].map(async (market) => {
      try {
        const reserve = await readReserve(market.asset).catch(() => null);
        const oracle = reserve && reserve.priceUsd > 0 ? reserve.priceUsd : null;
        const price = oracle ?? await assetPriceUsd(market.asset).catch(() => null);
        return {
          coin: market.coin,
          price,
          supplyApr: reserve ? Number(reserve.liquidityRate / 10n ** 23n) / 100 : null,
        };
      } catch {
        return { coin: market.coin, price: null, supplyApr: null };
      }
    }))
      .then((rows) => {
        if (!cancel) setQuotes(rows);
      })
      .catch((err: unknown) => {
        if (!cancel) setError(err instanceof Error ? err.message : 'Prices unavailable');
      });
    return () => {
      cancel = true;
    };
  }, []);

  const equity = book.equityUsd;
  const cashShare = equity > 0 ? Math.max(0, Math.min(1, book.cashUsd / equity)) : 0;
  const bookShare = equity > 0 ? Math.max(0, 1 - cashShare) : 0;

  return (
    <div className="ob-page">
      <header className="ob-head">
        <div>
          <h1>Overview</h1>
          <p className="ob-sub">
            {book.account
              ? `${book.account.name} account with ${usd(book.account.capitalUsd)} virtual capital. Same rules on every size.`
              : 'Your paper account, where capital can go now, and live markets.'}
          </p>
        </div>
        <div className="ob-cta">
          <Link className="ob-btn" to="/app/portfolio">Portfolio</Link>
          <Link className="ob-btn-ghost" to="/app/spot">Trade on Axis</Link>
          <Link className="ob-btn-ghost" to="/app/aave">Open a strategy</Link>
          <Link className="ob-btn-ghost" to="/app/liquidity">Provide liquidity</Link>
        </div>
      </header>

      <div className="ob-home">
        <div className="ob-home-main">
          <section className="ob-panel ob-equity">
            <div className="ob-equity-top">
              <p className="ob-kicker">Total equity</p>
              <h2 className="ob-mono">{usd(equity)}</h2>
              <p className={`ob-equity-delta ${tone(book.openPnlUsd)}`}>
                {signedUsd(book.openPnlUsd)} open · {open} open, {closed} closed
              </p>
              <div className="ob-mix" aria-hidden="true">
                <i className="is-cash" style={{ width: `${cashShare * 100}%` }} />
                <i style={{ width: `${bookShare * 100}%` }} />
              </div>
              <p className="ob-mix-key">
                <span><i className="is-cash" />Cash {(cashShare * 100).toFixed(0)}%</span>
                <span><i />In positions {(bookShare * 100).toFixed(0)}% ({usd(book.deployedUsd)})</span>
              </p>
            </div>
            <div className="ob-equity-stats">
              <div>
                <span>Cash</span>
                <b className="ob-mono">{usd(book.cashUsd)}</b>
              </div>
              <div>
                <span>Open PnL</span>
                <b className={`ob-mono ${tone(book.openPnlUsd)}`}>{signedUsd(book.openPnlUsd)}</b>
              </div>
              <div>
                <span>Realized</span>
                <b className={`ob-mono ${tone(book.realizedUsd)}`}>{signedUsd(book.realizedUsd)}</b>
              </div>
            </div>
          </section>

          <Positions board empty="No open positions yet." />

          <div className="ob-cards">
            <article className="ob-card">
              <h2>Aave supply <span className="ob-note">Supply APR</span></h2>
              {!quotes && <p className="ob-empty">Loading rates…</p>}
              {quotes?.filter((quote) => quote.coin === 'USDC' || quote.coin === 'ETH' || quote.coin === 'BTC').map((quote) => (
                <Link key={quote.coin} className="ob-row" to="/app/aave">
                  <Token symbol={quote.coin} />
                  <span>
                    <b>{quote.coin}</b>
                    <em>Supply APR</em>
                  </span>
                  <b className="ob-mono">{quote.supplyApr == null ? '—' : `${quote.supplyApr.toFixed(2)}%`}</b>
                </Link>
              ))}
            </article>
            <article className="ob-card">
              <h2>Top Uniswap pools <span className="ob-note">Fee APR</span></h2>
              {topPools.length === 0 && <p className="ob-empty">Reading full-range APR…</p>}
              {topPools.map(({ pool, stat }) => (
                <Link key={pool.id} className="ob-row" to="/app/liquidity">
                  <Token symbol={coinOfPool(pool.label)} />
                  <span>
                    <b>{pool.label}</b>
                    <em>{feeLabel(pool.feePips)} · full range</em>
                  </span>
                  <b className="ob-mono">{aprText(stat.fullRangeApr)}</b>
                </Link>
              ))}
            </article>
          </div>
        </div>

        <aside className="ob-home-side">
          {book.account && <Evaluation account={book.account} equity={book.equityUsd} />}
          <section className="ob-panel">
            <h2>Markets <span className="ob-note">Aave oracle</span></h2>
            {error && <p className="ob-empty">{error}</p>}
            {!quotes && !error && <p className="ob-empty">Loading prices…</p>}
            {quotes?.filter((quote) => quote.coin !== 'USDC').map((quote) => (
              <Link key={quote.coin} className="ob-market" to={`/app/spot?coin=${quote.coin}`}>
                <Token symbol={quote.coin} />
                <span>
                  <b>{quote.coin}</b>
                  <em>{quote.supplyApr != null ? `Supply ${quote.supplyApr.toFixed(2)}%` : quote.price == null ? 'Price unavailable' : 'Spot'}</em>
                </span>
                <b className="ob-mono">{quote.price == null ? '—' : `$${quote.price.toLocaleString('en-US', { maximumFractionDigits: quote.price < 100 ? 2 : 0 })}`}</b>
              </Link>
            ))}
          </section>
        </aside>
      </div>
    </div>
  );
}

function pct(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function Evaluation({ account, equity }: { account: EvalAccount; equity: number }) {
  const profit = (equity - account.capitalUsd) / account.capitalUsd;
  const daily = Math.max(0, account.dayEquityUsd - equity) / account.capitalUsd;
  const total = Math.max(0, account.capitalUsd - equity) / account.capitalUsd;
  const bars = [
    { label: 'Profit target', used: profit, limit: account.profitTargetPct },
    { label: 'Daily loss', used: daily, limit: account.dailyLossPct },
    { label: 'Total loss', used: total, limit: account.totalLossPct },
  ];
  return (
    <section className="ob-panel ob-risk">
      <h2>Risk limits <span className="ob-note">Used / limit</span></h2>
      {bars.map((bar) => {
        const ratio = bar.limit > 0 ? bar.used / bar.limit : 0;
        return (
          <div key={bar.label} className={ratio >= 0.8 ? 'ob-limit is-hot' : 'ob-limit'}>
            <p>
              {bar.label}
              <b className="ob-mono">{pct(bar.used)} / {pct(bar.limit)}</b>
            </p>
            <i>
              <b style={{ width: `${Math.min(100, Math.max(0, ratio * 100))}%` }} />
            </i>
          </div>
        );
      })}
    </section>
  );
}

function coinOfPool(label: string): string {
  return label.split('/')[0]?.trim() || 'ETH';
}

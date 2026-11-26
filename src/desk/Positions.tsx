import { useState } from 'react';
import type { PaperPosition } from '@/engine';
import type { LpSnapshot } from '@/engine/lp';
import { signedUsd, tone, usd } from './format';
import { coinOf, findAsset } from './markets';
import { useBook } from './book';

function token(address: string): string {
  try {
    return coinOf(findAsset(address).symbol);
  } catch {
    return '—';
  }
}

function pair(position: PaperPosition): string | null {
  const lp = position.kind === 2
    ? position.snapshot as LpSnapshot
    : position.kind === 8
      ? (position.snapshot as { lp: LpSnapshot }).lp
      : null;
  if (!lp) return null;
  return `${token(lp.token0)} / ${token(lp.token1)}`;
}

export function positionLabel(position: PaperPosition, options?: { fees?: boolean }): { title: string; detail: string } {
  return { title: title(position), detail: detail(position, options?.fees !== false) };
}

export function positionStatus(position: PaperPosition): { label: string; tone: 'live' | 'down' | 'flat' } {
  if (position.status === 'closed') return { label: 'Closed', tone: 'flat' };
  if (position.mark?.liquidated) return { label: 'Liquidated', tone: 'down' };
  if (position.mark?.inRange === true) return { label: 'In range', tone: 'live' };
  if (position.mark?.inRange === false) return { label: 'Out of range', tone: 'down' };
  return { label: 'Open', tone: 'live' };
}

function title(position: PaperPosition): string {
  const symbol = coinOf(String(position.params.symbol ?? ''));
  const range = pair(position);
  if (position.kind === 2) return range ?? 'Liquidity';
  if (position.kind === 4) return symbol;
  if (position.kind === 5) return `Supply ${symbol}`;
  if (position.kind === 6) return `Long ${symbol}`;
  if (position.kind === 7) return `Short ${symbol}`;
  if (position.kind === 8) return `Borrow · ${range ?? 'LP'}`;
  return `Basket ${symbol}`;
}

function detail(position: PaperPosition, fees = true): string {
  const mark = position.mark;
  if (!mark) return 'Waiting for a mark';
  const bits: string[] = [];
  if (mark.healthFactor != null) bits.push(`HF ${mark.healthFactor.toFixed(2)}`);
  if (mark.liquidated) bits.push('Liquidated');
  if (mark.inRange != null) bits.push(mark.inRange ? 'In range' : 'Out of range');
  if (fees && mark.feesUsd) {
    if (position.kind === 2 || position.kind === 8) bits.push(`LP fees ${usd(mark.feesUsd)}`);
    else if (position.kind === 4) bits.push(`Trade fee ${usd(mark.feesUsd)}`);
  }
  if (mark.interestUsd) bits.push(`Interest ${usd(mark.interestUsd)}`);
  if (mark.liquidationPriceUsd) bits.push(`Liq ${usd(mark.liquidationPriceUsd, mark.liquidationPriceUsd >= 1000 ? 0 : 2)}`);
  return bits.join(' · ') || usd(mark.equityUsd);
}

export function Positions({ kinds, empty, heading = 'Positions', board = false }: { kinds?: number[]; empty: string; heading?: string; board?: boolean }) {
  const book = useBook();
  const [closed, setClosed] = useState(false);
  const rows = book.positions.filter((position) => (
    (kinds == null || kinds.includes(position.kind)) && (closed || position.status === 'open')
  ));
  if (board) {
    return (
      <section className="ob-panel ob-board">
        <h2>
          {heading}
          <button type="button" className="ob-text" onClick={() => setClosed((value) => !value)}>
            {closed ? 'Hide closed' : 'Show closed'}
          </button>
        </h2>
        {rows.length === 0 && <p className="ob-empty">{empty}</p>}
        {rows.length > 0 && (
          <div className="ob-board-head">
            <span>Position</span>
            <span>Status</span>
            <span className="ob-board-num">PnL</span>
            <span className="ob-board-num">Actions</span>
          </div>
        )}
        {rows.map((position) => {
          const pnl = position.close?.pnlUsd ?? position.mark?.pnlUsd ?? 0;
          const status = positionStatus(position);
          return (
            <article key={position.id} className="ob-board-row">
              <span>
                <b>{title(position)}</b>
                <em>{detail(position)}</em>
              </span>
              <span className={`ob-badge${status.tone === 'flat' ? '' : ` is-${status.tone}`}`}>{status.label}</span>
              <b className={`ob-mono ob-board-num ${tone(pnl)}`}>{signedUsd(pnl)}</b>
              <span className="ob-actions">
                {position.status === 'open' && (
                  <button type="button" className="ob-mini" disabled={book.pending} onClick={() => void book.close(position.id)}>Close</button>
                )}
              </span>
            </article>
          );
        })}
      </section>
    );
  }
  return (
    <section className="ob-pos">
      <header className="ob-head">
        <span>{heading}</span>
        <button type="button" className="ob-text" onClick={() => setClosed((value) => !value)}>
          {closed ? 'Hide closed' : 'Show closed'}
        </button>
      </header>
      {rows.length === 0 && <p className="ob-empty">{empty}</p>}
      {rows.map((position) => {
        const pnl = position.close?.pnlUsd ?? position.mark?.pnlUsd ?? 0;
        return (
          <article key={position.id}>
            <div>
              <b>{title(position)}</b>
              <small>
                {position.status === 'closed' ? 'Closed · ' : ''}
                {detail(position)}
              </small>
            </div>
            <div className="ob-actions">
              <b className={`ob-mono ${tone(pnl)}`}>{signedUsd(pnl)}</b>
              {position.status === 'open' && (
                <button type="button" className="ob-mini" disabled={book.pending} onClick={() => void book.close(position.id)}>Close</button>
              )}
            </div>
          </article>
        );
      })}
    </section>
  );
}

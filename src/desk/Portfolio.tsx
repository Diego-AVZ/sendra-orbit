import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { PaperPosition } from '@/engine';
import { principalOf, useBook } from './book';
import { signedPct, signedUsd, tone, usd } from './format';
import { positionLabel, positionStatus } from './Positions';

type Status = 'active' | 'closed' | 'all';
type Family = 'all' | 'spot' | 'lp' | 'aave';
type Tab = 'positions' | 'performance';
type View = 'list' | 'grid' | 'scan' | 'graph';

function familyOf(kind: number): Exclude<Family, 'all'> {
  if (kind === 4) return 'spot';
  if (kind === 2) return 'lp';
  return 'aave';
}

function pnlOf(position: PaperPosition): number {
  return position.close?.pnlUsd ?? position.mark?.pnlUsd ?? 0;
}

function feesOf(position: PaperPosition): number | null {
  if (position.kind !== 2 && position.kind !== 8) return null;
  return position.close?.feesUsd ?? position.mark?.feesUsd ?? 0;
}

function valueOf(position: PaperPosition): number {
  if (position.status === 'closed') return position.close?.equityUsd ?? principalOf(position);
  return position.mark?.equityUsd ?? principalOf(position);
}

function savedView(): View {
  try {
    const saved = localStorage.getItem('orbit.portfolio.view');
    if (saved === 'list' || saved === 'grid' || saved === 'scan' || saved === 'graph') return saved;
  } catch {
    /* private mode */
  }
  return 'scan';
}

function equityPoints(positions: PaperPosition[], nowEquity: number, start: number): { t: number; v: number }[] {
  const events: { t: number; cashDelta: number; bookDelta: number }[] = [];
  for (const position of positions) {
    const principal = principalOf(position);
    const opened = Date.parse(position.openedAt);
    if (Number.isFinite(opened)) events.push({ t: opened, cashDelta: -principal, bookDelta: principal });
    if (position.status === 'closed' && position.closedAt) {
      const closed = Date.parse(position.closedAt);
      if (Number.isFinite(closed)) {
        events.push({
          t: closed,
          cashDelta: position.close?.equityUsd ?? principal,
          bookDelta: -principal,
        });
      }
    }
  }
  events.sort((a, b) => a.t - b.t || a.bookDelta - b.bookDelta);
  let cash = start;
  let book = 0;
  const points = [{ t: (events[0]?.t ?? Date.now()) - 60_000, v: start }];
  for (const event of events) {
    cash += event.cashDelta;
    book += event.bookDelta;
    points.push({ t: event.t, v: cash + book });
  }
  points.push({ t: Date.now(), v: nowEquity });
  return points;
}

function EquityChart({ points }: { points: { t: number; v: number }[] }) {
  if (points.length < 2) return <div className="ob-chart-empty">Equity shows up with the first fill.</div>;
  const lo = Math.min(...points.map((point) => point.v));
  const hi = Math.max(...points.map((point) => point.v));
  const span = hi - lo || Math.abs(hi) * 0.02 || 1;
  const pad = span * 0.45;
  const width = 800;
  const height = 220;
  const x = (index: number) => (index / (points.length - 1)) * width;
  const y = (value: number) => 16 + (1 - (value - (lo - pad)) / (span + pad * 2)) * (height - 32);
  const line = points.map((point, index) => `${x(index)},${y(point.v)}`).join(' ');
  const up = points[points.length - 1].v >= points[0].v;
  const color = up ? 'var(--up)' : 'var(--down)';
  return (
    <svg className="ob-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Account equity">
      <polygon points={`0,${height} ${line} ${width},${height}`} fill={color} opacity="0.12" />
      <polyline points={line} fill="none" stroke={color} strokeWidth="2" />
    </svg>
  );
}

const FAMILY_LABEL = { spot: 'Spot', lp: 'LP', aave: 'Aave' } as const;

function Icon({ d }: { d: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

function Actions({ id }: { id: string }) {
  const book = useBook();
  return (
    <span className="ob-actions">
      <button type="button" className="ob-mini" disabled={book.pending} onClick={() => void book.close(id)}>Close</button>
    </span>
  );
}

export function Portfolio() {
  const book = useBook();
  const [tab, setTab] = useState<Tab>('positions');
  const [status, setStatus] = useState<Status>('active');
  const [family, setFamily] = useState<Family>('all');
  const [view, setView] = useState<View>(savedView);
  const positions = book.positions;
  const open = positions.filter((position) => position.status === 'open');
  const closed = positions.filter((position) => position.status === 'closed');
  const wins = closed.filter((position) => pnlOf(position) > 0).length;
  const capital = positions.reduce((sum, position) => sum + principalOf(position), 0);
  const profit = book.realizedUsd + book.openPnlUsd;
  const profitPct = capital > 0 ? (profit / capital) * 100 : 0;
  const openValue = open.reduce((sum, position) => sum + (position.mark?.equityUsd ?? principalOf(position)), 0);
  const points = useMemo(() => equityPoints(positions, book.equityUsd, book.capitalUsd), [book.capitalUsd, book.equityUsd, positions]);
  const rows = positions.filter((position) => {
    if (status === 'active' && position.status !== 'open') return false;
    if (status === 'closed' && position.status !== 'closed') return false;
    if (family !== 'all' && familyOf(position.kind) !== family) return false;
    return true;
  });
  const present = new Set(positions.map((position) => familyOf(position.kind)));
  const types = (['spot', 'lp', 'aave'] as const).filter((name) => present.has(name));
  const books = (['spot', 'lp', 'aave'] as const).map((name) => {
    const group = positions.filter((position) => familyOf(position.kind) === name);
    const live = group.filter((position) => position.status === 'open');
    return {
      name,
      count: group.length,
      open: live.length,
      value: live.reduce((sum, position) => sum + (position.mark?.equityUsd ?? principalOf(position)), 0),
      pnl: group.reduce((sum, position) => sum + pnlOf(position), 0),
      rows: group,
    };
  }).filter((row) => row.count > 0);
  const maxValue = Math.max(1, ...books.map((row) => row.value));
  const closedPnls = closed.map(pnlOf);
  const best = closedPnls.length ? Math.max(...closedPnls) : 0;
  const worst = closedPnls.length ? Math.min(...closedPnls) : 0;

  const chooseView = (next: View) => {
    setView(next);
    try { localStorage.setItem('orbit.portfolio.view', next); } catch { /* ignore */ }
  };

  return (
    <div className="ob-page">
      <section className="ob-panel ob-summary">
        <div className="ob-summary-top">
          <div>
            <p className="ob-kicker">Value in open positions</p>
            <h1 className="ob-mono">{usd(openValue)}</h1>
          </div>
          <div className="ob-summary-side">
            <div>
              <p className="ob-kicker">PnL</p>
              <b className={`ob-mono ${tone(profit)}`}>{signedUsd(profit)}</b>
              <span className={tone(profitPct)}>{signedPct(profitPct)}</span>
            </div>
            <div>
              <p className="ob-kicker">Open positions</p>
              <b className="ob-mono">{open.length}</b>
              <span className="ob-note">of {positions.length} total</span>
            </div>
          </div>
        </div>
        <dl className="ob-stats ob-stats-5">
          <div>
            <dt>Realized PnL</dt>
            <dd className={`ob-mono ${tone(book.realizedUsd)}`}>{signedUsd(book.realizedUsd)}</dd>
          </div>
          <div>
            <dt>Unrealized PnL</dt>
            <dd className={`ob-mono ${tone(book.openPnlUsd)}`}>{signedUsd(book.openPnlUsd)}</dd>
          </div>
          <div>
            <dt>Capital put in</dt>
            <dd className="ob-mono">{usd(capital)}</dd>
          </div>
          <div>
            <dt>Cash</dt>
            <dd className="ob-mono">{usd(book.cashUsd)}</dd>
          </div>
          <div>
            <dt>Win rate</dt>
            <dd className="ob-mono">{closed.length ? `${((wins / closed.length) * 100).toFixed(0)}%` : '—'}</dd>
          </div>
        </dl>
      </section>

      <div className="ob-tabs" role="tablist" aria-label="Portfolio">
        {([['positions', 'Positions'], ['performance', 'Performance']] as const).map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'is-on' : ''} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
        <Link className="ob-text" to="/app/spot">Trade</Link>
      </div>

      {tab === 'positions' ? (
        <>
          <div className="ob-toolbar">
            <div className="ob-view" role="radiogroup" aria-label="View mode">
              {([
                ['list', 'List', 'M2 3.5h11M2 7.5h11M2 11.5h11'],
                ['grid', 'Grid', 'M2.5 2.5h4v4h-4zM8.5 2.5h4v4h-4zM2.5 8.5h4v4h-4zM8.5 8.5h4v4h-4z'],
                ['scan', 'Compact list', 'M2 4h11M2 7.5h11M2 11h11'],
                ['graph', 'Graph', 'M3 4.5h3.2v2.2H3zM8.8 8h3.2v2.2H8.8zM3 10.2h3.2V12.4H3z'],
              ] as const).map(([id, label, d]) => (
                <button key={id} type="button" className={view === id ? 'is-on' : ''} aria-label={label} title={label} onClick={() => chooseView(id)}>
                  <Icon d={d} />
                </button>
              ))}
            </div>
            <span className="ob-rule" />
            <div className="ob-pills" role="radiogroup" aria-label="Status">
              {([['all', 'All'], ['active', 'Active'], ['closed', 'Closed']] as const).map(([id, label]) => (
                <button key={id} type="button" className={status === id ? 'is-on' : ''} onClick={() => setStatus(id)}>{label}</button>
              ))}
            </div>
            {types.length > 1 && (
              <>
                <span className="ob-rule" />
                <div className="ob-pills" role="radiogroup" aria-label="Type">
                  <button type="button" className={family === 'all' ? 'is-on' : ''} onClick={() => setFamily('all')}>All types</button>
                  {types.map((item) => (
                    <button key={item} type="button" className={family === item ? 'is-on' : ''} onClick={() => setFamily(item)}>
                      {FAMILY_LABEL[item]}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          {rows.length === 0 && (
            <p className="ob-empty ob-panel">{positions.length ? 'No positions found' : 'No positions yet. A spot fill, an Aave supply, or a range will land here.'}</p>
          )}
          {rows.length > 0 && view === 'scan' && (
            <section className="ob-panel ob-scan">
              <div className="ob-scan-head">
                <span>Type</span>
                <span>Position</span>
                <span>Status</span>
                <span className="ob-scan-num">Capital</span>
                <span className="ob-scan-num">LP fees</span>
                <span className="ob-scan-num">PnL</span>
                <span />
              </div>
              {rows.map((position) => {
                const label = positionLabel(position, { fees: false });
                const state = positionStatus(position);
                const fees = feesOf(position);
                return (
                  <article key={position.id} className="ob-scan-line">
                    <span className="ob-note">{FAMILY_LABEL[familyOf(position.kind)]}</span>
                    <span>
                      <b>{label.title}</b>
                      <em>{label.detail}</em>
                    </span>
                    <span><span className={`ob-badge${state.tone === 'flat' ? '' : ` is-${state.tone}`}`}>{state.label}</span></span>
                    <b className="ob-mono ob-scan-num">{usd(principalOf(position))}</b>
                    <b className={`ob-mono ob-scan-num${fees != null && fees !== 0 ? ` ${tone(fees)}` : ''}`}>{fees == null ? '—' : usd(fees)}</b>
                    <b className={`ob-mono ob-scan-num ${tone(pnlOf(position))}`}>{signedUsd(pnlOf(position))}</b>
                    {position.status === 'open' ? <Actions id={position.id} /> : <span />}
                  </article>
                );
              })}
            </section>
          )}
          {rows.length > 0 && view === 'list' && (
            <div className="ob-stack">
              {rows.map((position) => {
                const label = positionLabel(position);
                const state = positionStatus(position);
                return (
                  <article key={position.id} className="ob-panel ob-board-row">
                    <span>
                      <b>{label.title}</b>
                      <em>{FAMILY_LABEL[familyOf(position.kind)]} · {state.label} · {label.detail}</em>
                    </span>
                    <b className="ob-mono">{usd(valueOf(position))}</b>
                    <b className={`ob-mono ${tone(pnlOf(position))}`}>{signedUsd(pnlOf(position))}</b>
                    {position.status === 'open' ? <Actions id={position.id} /> : <span />}
                  </article>
                );
              })}
            </div>
          )}
          {rows.length > 0 && view === 'grid' && (
            <div className="ob-grid-cards">
              {rows.map((position) => {
                const label = positionLabel(position);
                const state = positionStatus(position);
                return (
                  <article key={position.id} className="ob-poscard">
                    <span className="ob-note">{FAMILY_LABEL[familyOf(position.kind)]}</span>
                    <b>{label.title}</b>
                    <em>{state.label} · {label.detail}</em>
                    <b className="ob-mono">{usd(valueOf(position))}</b>
                    <em className={tone(pnlOf(position))}>{signedUsd(pnlOf(position))}</em>
                    {position.status === 'open' && <Actions id={position.id} />}
                  </article>
                );
              })}
            </div>
          )}
          {rows.length > 0 && view === 'graph' && <BookGraph rows={rows} />}
        </>
      ) : (
        <div className="ob-layout">
          <section className="ob-panel">
            <h2>Equity <span className="ob-note">from {usd(book.capitalUsd)}</span></h2>
            <div className="ob-spark">
              <EquityChart points={points} />
            </div>
            <dl className="ob-stats ob-flush">
              <div>
                <dt>Closed</dt>
                <dd className="ob-mono">{closed.length}</dd>
              </div>
              <div>
                <dt>Best close</dt>
                <dd className={`ob-mono ${tone(best)}`}>{closed.length ? signedUsd(best) : '—'}</dd>
              </div>
              <div>
                <dt>Worst close</dt>
                <dd className={`ob-mono ${tone(worst)}`}>{closed.length ? signedUsd(worst) : '—'}</dd>
              </div>
            </dl>
          </section>
          <section className="ob-panel">
            <h2>By book</h2>
            {books.length === 0 && <p className="ob-empty">Open a position to see how the account is split.</p>}
            {books.map((row) => (
              <div key={row.name} className="ob-alloc">
                <div>
                  <b>{FAMILY_LABEL[row.name]}</b>
                  <em>{row.open} open · {row.count} total</em>
                </div>
                <div className="ob-track"><i style={{ width: `${(row.value / maxValue) * 100}%` }} /></div>
                <div>
                  <b className="ob-mono">{usd(row.value)}</b>
                  <em className={tone(row.pnl)}>{signedUsd(row.pnl)}</em>
                </div>
              </div>
            ))}
          </section>
        </div>
      )}
    </div>
  );
}

function BookGraph({ rows }: { rows: PaperPosition[] }) {
  const groups = (['spot', 'lp', 'aave'] as const).map((name) => ({
    name,
    rows: rows.filter((position) => familyOf(position.kind) === name),
  })).filter((group) => group.rows.length > 0);
  const value = rows.filter((position) => position.status === 'open').reduce((sum, position) => sum + valueOf(position), 0);
  return (
    <div className="ob-graph">
      <div className="ob-graph-account">
        <span className="ob-kicker">Account</span>
        <b className="ob-mono">{usd(value)}</b>
        <em className="ob-note">{rows.length} in view</em>
      </div>
      <div className="ob-graph-books">
        {groups.map((group) => (
          <section key={group.name} className="ob-graph-book">
            <h3>{FAMILY_LABEL[group.name]} · {group.rows.length}</h3>
            <div className="ob-graph-nodes">
              {group.rows.map((position) => {
                const label = positionLabel(position);
                return (
                  <article key={position.id}>
                    <b>{label.title}</b>
                    <em className={tone(pnlOf(position))}>{signedUsd(pnlOf(position))}</em>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

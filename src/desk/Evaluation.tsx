import type { EvalAccount } from '@/engine/accounts';
import type { PaperPosition } from '@/engine/position';
import { principalOf, useBook } from './book';

const MIN_MONTHS = 2;
const MIN_PROFITABLE = 30;
const MIN_RETURN = 0.01;

function pct(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function tenure(createdAt: string, now = Date.now()) {
  const start = Date.parse(createdAt);
  if (!Number.isFinite(start)) return { ratio: 0, elapsed: 0, span: 1, done: false };
  const end = addMonths(new Date(start), MIN_MONTHS).getTime();
  const span = Math.max(1, end - start);
  const elapsed = Math.max(0, now - start);
  return { ratio: Math.min(1, elapsed / span), elapsed, span, done: now >= end };
}

function days(ms: number) {
  return Math.floor(ms / 86_400_000);
}

function tradeReturn(position: PaperPosition): number | null {
  const principal = principalOf(position);
  if (principal <= 0) return null;
  const pnl = position.close?.pnlUsd ?? position.mark?.pnlUsd ?? 0;
  return pnl / principal;
}

function Gate({
  label,
  value,
  ratio,
  done,
}: {
  label: string;
  value: string;
  ratio: number;
  done: boolean;
}) {
  return (
    <div className={done ? 'ob-limit is-done' : 'ob-limit'}>
      <p>
        {label}
        <b className="ob-mono">{value}</b>
      </p>
      <i>
        <b style={{ width: `${Math.min(100, Math.max(0, ratio * 100))}%` }} />
      </i>
    </div>
  );
}

function RiskLimits({ account, equity }: { account: EvalAccount; equity: number }) {
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

export function Evaluation() {
  const book = useBook();
  const account = book.account;
  const clock = tenure(account?.createdAt ?? '');
  const profitable = book.positions.filter((position) => {
    const ret = tradeReturn(position);
    return ret != null && ret > MIN_RETURN;
  }).length;
  const tradeRatio = Math.min(1, profitable / MIN_PROFITABLE);
  const daysIn = days(clock.elapsed);
  const daysNeed = days(clock.span);

  return (
    <div className="ob-page">
      <header className="ob-head">
        <div>
          <h1>Evaluation</h1>
          <p className="ob-sub">
            Stay on the account for two months and close or hold 30 trades that return more than 1%. Risk limits still apply.
          </p>
        </div>
      </header>
      {!account ? (
        <p className="ob-empty">No evaluation account selected.</p>
      ) : (
        <div className="ob-eval">
          <section className="ob-panel ob-risk">
            <h2>Progress <span className="ob-note">Minimums</span></h2>
            <Gate
              label="Time on account"
              value={clock.done ? `${daysIn}d · 2 months` : `${daysIn}d / ${daysNeed}d`}
              ratio={clock.ratio}
              done={clock.done}
            />
            <Gate
              label="Trades above 1%"
              value={`${profitable} / ${MIN_PROFITABLE}`}
              ratio={tradeRatio}
              done={profitable >= MIN_PROFITABLE}
            />
          </section>
          <RiskLimits account={account} equity={book.equityUsd} />
        </div>
      )}
    </div>
  );
}

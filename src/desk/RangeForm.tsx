import { price } from './format';
import { priceBand, type RangeMode, type Risk, type Strategy } from './markets';

const STRATEGIES: Strategy[] = ['bullish', 'neutral', 'bearish'];
const RISKS: Risk[] = ['low', 'medium', 'high'];

export function RangeForm({
  current,
  unit,
  mode,
  strategy,
  risk,
  lowPct,
  highPct,
  startInside,
  onMode,
  onStrategy,
  onRisk,
  onLow,
  onHigh,
  onInside,
}: {
  current: number;
  unit: string;
  mode: RangeMode;
  strategy: Strategy;
  risk: Risk;
  lowPct: string;
  highPct: string;
  startInside: boolean;
  onMode: (mode: RangeMode) => void;
  onStrategy: (strategy: Strategy) => void;
  onRisk: (risk: Risk) => void;
  onLow: (value: string) => void;
  onHigh: (value: string) => void;
  onInside: (value: boolean) => void;
}) {
  const band = priceBand(current, mode, strategy, risk, lowPct, highPct, startInside);
  const inside = current > 0 && current >= band.min && current < band.max;
  return (
    <div className="ob-form">
      <div>
        <p className="ob-label">Price range</p>
        <p className="ob-copy">The position earns fees only while the price stays inside. Narrower earns more per dollar and leaves the range sooner.</p>
      </div>
      <div className="ob-seg cols-2" role="radiogroup" aria-label="Range mode">
        {([['preset', 'Preset'], ['custom', 'Set manually']] as const).map(([id, label]) => (
          <button key={id} type="button" className={mode === id ? 'is-on' : ''} onClick={() => onMode(id)}>
            {label}
          </button>
        ))}
      </div>
      {mode === 'preset' ? (
        <>
          <div className="ob-seg cols-3" role="radiogroup" aria-label="Strategy">
            {STRATEGIES.map((item) => (
              <button key={item} type="button" className={strategy === item ? 'is-on' : ''} onClick={() => onStrategy(item)}>
                {item[0].toUpperCase() + item.slice(1)}
              </button>
            ))}
          </div>
          <div className="ob-seg cols-3" role="radiogroup" aria-label="Risk">
            {RISKS.map((item) => (
              <button key={item} type="button" className={risk === item ? 'is-on' : ''} onClick={() => onRisk(item)}>
                {item[0].toUpperCase() + item.slice(1)} risk
              </button>
            ))}
          </div>
          <label className="ob-check">
            <input type="checkbox" checked={startInside} onChange={(event) => onInside(event.target.checked)} />
            Start inside the current price
          </label>
        </>
      ) : (
        <div className="ob-seg" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <label className="ob-field" style={{ padding: 8 }}>
            <span>Below %</span>
            <input value={lowPct} inputMode="decimal" onChange={(event) => onLow(event.target.value)} />
          </label>
          <label className="ob-field" style={{ padding: 8 }}>
            <span>Above %</span>
            <input value={highPct} inputMode="decimal" onChange={(event) => onHigh(event.target.value)} />
          </label>
        </div>
      )}
      <div className="ob-band">
        <span>{band.min > 0 ? price(band.min) : '—'}</span>
        <b className="ob-mono">{inside ? 'In range' : current > 0 ? 'Out of range' : '—'}</b>
        <span>{band.max > 0 ? price(band.max) : '—'} {unit}</span>
      </div>
    </div>
  );
}

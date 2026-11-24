import { useState } from 'react';
import { RULES, type RuleId } from '@/features/landing/data';

const ORDER: RuleId[] = ['lp', 'aave', 'spot'];

export function Rules() {
  const [active, setActive] = useState<RuleId>('lp');
  const rule = RULES[active];

  return (
    <section className="land-sec" id="rules">
      <div className="land-wrap">
        <div className="land-sec-head reveal">
          <p className="land-kicker">Rules</p>
          <h2>Each book has its own limits.</h2>
          <p>A liquidity position and a lending book do not share one stop. The binding rules are published before purchase.</p>
        </div>
        <div className="reveal" style={{ marginTop: '1.8rem' }}>
          <div className="rule-tabs" role="tablist" aria-label="Strategy rules">
            {ORDER.map((id) => (
              <button key={id} type="button" role="tab" aria-selected={active === id} onClick={() => setActive(id)}>
                {RULES[id].label}
              </button>
            ))}
          </div>
          <dl className="rule-panel" role="tabpanel">
            {rule.lines.map(([name, line]) => (
              <div key={name}>
                <dt>{name}</dt>
                <dd>{line}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}

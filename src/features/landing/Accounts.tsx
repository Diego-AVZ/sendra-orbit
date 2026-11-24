import { useState } from 'react';
import { ACCOUNTS, INCLUDED, usd, type AccountId } from '@/features/landing/data';

export function Accounts({ onRequest }: { onRequest: (tier: AccountId) => void }) {
  const [selected, setSelected] = useState<AccountId>('advanced');
  const account = ACCOUNTS.find((item) => item.id === selected) ?? ACCOUNTS[1];

  return (
    <section className="land-sec" id="accounts">
      <div className="land-wrap">
        <div className="land-sec-head reveal">
          <p className="land-kicker">Accounts</p>
          <h2>Pay for the evaluation.</h2>
          <p>Three opening sizes. The prices are a hypothesis, published again before anyone is charged.</p>
        </div>
        <div className="land-rails reveal">
          {ACCOUNTS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={item.id === account.id ? 'price is-on' : 'price'}
              aria-pressed={item.id === account.id}
              onClick={() => setSelected(item.id)}
            >
              <p className="card-k">{item.name}</p>
              <strong>{usd(item.price)}</strong>
              <p>
                Virtual allocation <b style={{ color: '#f4f4f5' }}>{usd(item.capital)}</b>
              </p>
              <p>{item.line}</p>
            </button>
          ))}
        </div>
        <div className="sheet reveal">
          <div>
            <p className="card-k">{account.name} evaluation</p>
            <ul>
              {INCLUDED.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <button type="button" className="land-go" onClick={() => onRequest(account.id)}>
              Request {account.name}
            </button>
          </div>
          <div>
            <p className="card-k">Funded example</p>
            <p className="desk-figure" style={{ marginTop: '0.6rem' }}>
              {usd(3000)}
            </p>
            <div className="bar" aria-hidden="true">
              <b />
            </div>
            <p>
              On a {usd(300)} profit, the operator keeps {usd(240)} and the platform keeps {usd(60)}. An example, not an offer.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

import { ACCOUNTS, COMING, RULE_LINES, usd, type AccountId } from '@/features/landing/data';

export function Accounts({ onRequest }: { onRequest: (tier: AccountId) => void }) {
  return (
    <section className="land-sec" id="accounts">
      <div className="land-wrap">
        <div className="land-sec-head reveal">
          <p className="land-kicker">Accounts</p>
          <h2>Pay for the evaluation.</h2>
          <p>
            Four open sizes, and the same percentages on each. A larger account is not a harder test. The challenge is to make a return with the loss limits intact.
          </p>
        </div>
        <div className="land-rails reveal">
          {ACCOUNTS.map((plan) => (
            <article key={plan.id} className="price">
              <h3>{plan.name}</h3>
              {plan.badge ? <p className="card-k">{plan.badge}</p> : null}
              <p className="fee">
                {usd(plan.price)} <span>/ Challenge</span>
              </p>
              <p className="size">{usd(plan.capital)}</p>
              <p>Virtual account size</p>
              <ul>
                {RULE_LINES.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <button type="button" className="land-go" onClick={() => onRequest(plan.id)}>
                Request {plan.name}
              </button>
            </article>
          ))}
        </div>
        <div className="land-rails land-soon reveal">
          {COMING.map((plan) => (
            <article key={plan.id} className="price is-soon">
              <p className="card-k">Coming soon</p>
              <h3>{plan.name}</h3>
              <p className="size">{usd(plan.capital)}</p>
              <p>Virtual account size</p>
              <p className="soon-price">{usd(plan.price)} indicative</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

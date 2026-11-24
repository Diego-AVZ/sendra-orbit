import { withBase } from '@/lib/base';

const TAGS = ['Uniswap V3', 'Uniswap V4', 'Aave', 'Spot', 'Paper', 'Funded', 'Orbit Score'];

export function Hero({ onRequest }: { onRequest: () => void }) {
  return (
    <section className="land-hero" aria-labelledby="hero-title">
      <div className="land-planet" aria-hidden="true">
        <img src={withBase('/orbit-planet.jpg?v=moon')} alt="" width="2200" height="1900" fetchPriority="high" decoding="async" />
      </div>
      <div className="land-stars" aria-hidden="true" />
      <div className="land-wrap">
        <div className="land-hero-copy">
          <p className="land-eyebrow">Onchain strategy funding</p>
          <h1 id="hero-title">
            <span>Prove your</span>
            <em>strategy.</em>
          </h1>
          <p className="land-alt">Earn access to capital.</p>
          <p className="land-lede">
            <strong>Virtual capital. Real mechanics.</strong> Run Uniswap, Aave and spot on live market data. Pass the rules, and become eligible to manage capital through Sendra.
          </p>
          <div className="land-actions">
            <button type="button" className="land-go" onClick={onRequest}>
              Request access
            </button>
            <a className="land-ghost" href={withBase('/#path')}>
              See the path
            </a>
          </div>
          <ul className="land-tags" aria-label="What Orbit runs">
            {TAGS.map((tag) => (
              <li key={tag}>{tag}</li>
            ))}
          </ul>
        </div>

        <div className="desk-stage">
          <div className="desk-name">
            <span>
              <i className="desk-logo" />
              Orbit
            </span>
            <span>Paper evaluation · ETH/USDC</span>
            <em>Live mechanics</em>
          </div>
          <div className="desk-screens">
            <article className="desk-mon">
              <div className="desk-screen">
                <div className="desk-top">
                  Orbit paper
                  <em>In range</em>
                </div>
                <div className="desk-body">
                  <p className="desk-k">Uniswap V3 · 0.05%</p>
                  <p className="desk-figure">
                    ETH / USDC <small>range</small>
                  </p>
                  <div className="desk-range" aria-hidden="true">
                    <b />
                    <i />
                    <s />
                  </div>
                  <div className="desk-row">
                    <span>3,120</span>
                    <span>3,480</span>
                  </div>
                  <div className="desk-actions">
                    <span className="desk-buy">Fees +$186</span>
                    <span className="desk-sell">IL −$42</span>
                  </div>
                </div>
              </div>
            </article>
            <article className="desk-mon">
              <div className="desk-screen">
                <div className="desk-top">
                  Accounting
                  <em>+2.9%</em>
                </div>
                <div className="desk-body">
                  <p className="desk-k">Virtual capital</p>
                  <p className="desk-figure">$5,000</p>
                  <p className="desk-up">Net +$144.30</p>
                  <div className="desk-row">
                    <span>Drawdown</span>
                    <b>1.8%</b>
                  </div>
                  <div className="desk-row">
                    <span>Operator split</span>
                    <b>80 / 20</b>
                  </div>
                  <div className="desk-row">
                    <span>Status</span>
                    <b className="desk-up">Active</b>
                  </div>
                </div>
              </div>
            </article>
          </div>
        </div>
      </div>
    </section>
  );
}

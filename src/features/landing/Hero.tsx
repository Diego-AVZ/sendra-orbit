import { withBase } from '@/lib/base';
import { HorizonLines } from '@/features/landing/HorizonLines';

const TAGS = ['Uniswap V3', 'Uniswap V4', 'Aave', 'Spot', 'Paper', 'Funded', 'Orbit Score'];

export function Hero({ onRequest }: { onRequest: () => void }) {
  return (
    <section className="land-hero" aria-labelledby="hero-title">
      <div className="land-stars" aria-hidden="true" />
      <HorizonLines />
      <div className="land-planet" aria-hidden="true">
        <img className="land-planet-soft" src={withBase('/orbit-planet.jpg?v=moon')} alt="" width="2200" height="1900" decoding="async" />
        <img className="land-planet-core" src={withBase('/orbit-planet.jpg?v=moon')} alt="" width="2200" height="1900" fetchPriority="high" decoding="async" />
      </div>
      <div className="land-wrap">
        <div className="land-hero-copy">
          <p className="land-eyebrow">Onchain strategy funding</p>
          <h1 id="hero-title">
            <span>Prove your</span>
            <em>strategy.</em>
          </h1>
          <p className="land-alt">Earn access to capital.</p>
          <p className="land-lede">
            <strong>Virtual capital. Real mechanics.</strong> Run Uniswap, Aave and spot on live market data. Pass the Challenge, and become eligible to manage capital through Sendra.
          </p>
          <div className="land-actions">
            <a className="land-go" href={withBase('/app')}>
              Open app
            </a>
            <button type="button" className="land-ghost" onClick={onRequest}>
              Request access
            </button>
            <a className="land-link" href={withBase('/#path')}>
              See the path
            </a>
          </div>
          <p className="land-meta">{TAGS.join('  ·  ')}</p>
        </div>
      </div>
    </section>
  );
}

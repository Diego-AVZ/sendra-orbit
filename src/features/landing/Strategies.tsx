export function Strategies() {
  return (
    <section className="land-sec" id="strategies">
      <div className="land-wrap">
        <div className="land-sec-head reveal">
          <p className="land-kicker">Strategies</p>
          <h2>Real mechanics. Three books.</h2>
          <p>Fees, ranges, health factor and impermanent loss are the result. A candle approximation is not how an operator is certified.</p>
        </div>
        <div className="strat-grid reveal">
          <article className="strat">
            <p className="card-k">Initial priority</p>
            <h3>Uniswap LP</h3>
            <p>Pool, fee tier and range. The engine follows tick liquidity, fee growth and the path of price.</p>
            <svg className="range-sketch" viewBox="0 0 420 92" aria-hidden="true">
              <rect x="78" y="16" width="200" height="52" rx="8" fill="rgba(77,139,255,0.16)" stroke="#4d8bff" />
              <path d="M8 70 C 50 64, 90 40, 140 36 S 220 58, 280 28 S 360 48, 412 34" fill="none" stroke="#f4f4f5" strokeWidth="2" />
              <circle cx="250" cy="32" r="4" fill="#fff" />
            </svg>
          </article>
          <div className="strat-side">
            <article className="strat">
              <h3>Aave</h3>
              <p>Supply, borrow, interest. The health factor has a floor.</p>
              <p className="hf">1.84</p>
            </article>
            <article className="strat">
              <h3>Spot</h3>
              <ul className="book">
                <li>ETH <span>42%</span></li>
                <li>USDC <span>36%</span></li>
                <li>WBTC <span>22%</span></li>
              </ul>
            </article>
          </div>
        </div>
        <p className="reveal" style={{ marginTop: '1rem', color: 'rgba(244,244,245,0.68)' }}>
          Later on the same rails: Hyperliquid, Elysium and pair trading.
        </p>
      </div>
    </section>
  );
}

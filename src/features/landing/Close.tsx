export function Close({ onRequest }: { onRequest: () => void }) {
  return (
    <section className="land-cta" id="request">
      <div className="land-wrap reveal">
        <div>
          <p className="land-kicker">First cohort</p>
          <h2>
            Build the environment.
            <em> Discover the operators.</em> Allocate the capital.
          </h2>
          <p className="land-lede">
            The first release is the evaluation and the paper book: Uniswap LP, Aave and spot. Real capital follows the simulation, the risk engine and the legal review.
          </p>
        </div>
        <div className="ask">
          <p className="k">Evaluation</p>
          <strong>Connect a wallet and take a challenge.</strong>
          <p className="fine">Payment is simulated. Each purchase adds its own account, with its own capital and its own result.</p>
          <button type="button" className="land-go" onClick={onRequest}>
            Request access
          </button>
        </div>
      </div>
    </section>
  );
}

import { RequestForm } from '@/features/landing/RequestForm';

export function Close() {
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
        <RequestForm initialTier="general" idPrefix="close" />
      </div>
    </section>
  );
}

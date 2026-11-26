import { PATH, TERMS } from '@/features/landing/data';

export function PathSection() {
  return (
    <section className="land-sec" id="path">
      <div className="land-wrap">
        <div className="land-sec-head reveal">
          <p className="land-kicker">The path</p>
          <h2>Enter. Prove. Progress.</h2>
          <p>An operator is tested in simulation, then with limited real capital, and can earn the full allocation.</p>
        </div>
        <ol className="land-steps reveal">
          {PATH.map((step) => (
            <li key={step.n}>
              <small>{step.n}</small>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </li>
          ))}
        </ol>
        <ul className="land-tags reveal" style={{ marginTop: '1.4rem' }}>
          {TERMS.map((term) => (
            <li key={term.name}>
              {term.name} · {term.line}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const LAYERS = [
  { name: 'Blackhole', line: 'Executes, accounts, and holds funded capital inside the enclave.' },
  { name: 'Orbit', line: 'Finds the operators, runs the evaluation, and funds the ones who qualify.' },
  { name: 'Creator Studio', line: 'Later, other teams launch their own program on the same rails.' },
];

export function Infrastructure() {
  return (
    <section className="land-sec" aria-labelledby="stack-title">
      <div className="land-wrap">
        <div className="land-sec-head reveal">
          <p className="land-kicker">The stack</p>
          <h2 id="stack-title">One infrastructure. Three roles.</h2>
        </div>
        <ul className="stack reveal">
          {LAYERS.map((layer) => (
            <li key={layer.name}>
              <h3>{layer.name}</h3>
              <p>{layer.line}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

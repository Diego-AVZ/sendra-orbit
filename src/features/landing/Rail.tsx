const ITEMS = [
  'Uniswap V3',
  'Uniswap V4',
  'Aave',
  'Spot',
  'Fee growth',
  'Health factor',
  'Impermanent loss',
  'Drawdown',
  'Orbit Score',
];

export function Rail() {
  const row = [...ITEMS, ...ITEMS];
  return (
    <div className="overflow-hidden border-y border-white/10 py-4" aria-hidden>
      <div className="marquee-track flex w-max gap-10 px-6">
        {row.map((item, index) => (
          <span key={`${item}-${index}`} className="text-xs uppercase tracking-eyebrow text-mist">
            {item}
            <span className="ml-10 text-copper">·</span>
          </span>
        ))}
      </div>
    </div>
  );
}

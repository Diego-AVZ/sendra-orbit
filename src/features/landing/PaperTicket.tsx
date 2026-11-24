const ROWS = [
  ['Fees earned', '+$186.40', 'text-moss'],
  ['Impermanent loss', '−$42.10', 'text-ivory/80'],
  ['Net', '+$144.30', 'text-moss'],
  ['Drawdown', '1.8%', 'text-ivory'],
] as const;

export function PaperTicket() {
  return (
    <article className="rounded-3xl border border-white/10 bg-ink/75 p-5 shadow-ticket backdrop-blur-md">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] uppercase tracking-eyebrow text-mist">Orbit Paper</p>
        <p className="inline-flex items-center gap-2 text-[11px] uppercase tracking-eyebrow text-moss">
          <span className="h-1.5 w-1.5 rounded-full bg-moss" aria-hidden />
          In range
        </p>
      </div>
      <h3 className="mt-4 font-serif text-2xl text-ivory">ETH / USDC</h3>
      <p className="mt-1 text-sm text-mist">Uniswap V3 · 0.05% · virtual capital</p>

      <div className="mt-5">
        <div className="flex justify-between text-xs tabular-nums text-mist">
          <span>3,120</span>
          <span>3,480</span>
        </div>
        <div className="relative mt-2 h-px bg-white/15" aria-hidden>
          <div className="absolute inset-y-0 left-[16%] right-[18%] bg-copper" />
          <div className="absolute left-[58%] top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cream shadow-[0_0_12px_#e3a45c]" />
        </div>
      </div>

      <dl className="mt-5 space-y-2 text-sm">
        {ROWS.map(([label, value, tone]) => (
          <div key={label} className="flex items-baseline justify-between gap-4">
            <dt className="text-mist">{label}</dt>
            <dd className={`tabular-nums ${tone}`}>{value}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

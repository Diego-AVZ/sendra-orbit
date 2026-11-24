import type { ReactNode } from 'react';

export function SectionHeading({
  index,
  kicker,
  title,
  children,
}: {
  index: string;
  kicker: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="max-w-2xl">
      <p className="text-xs uppercase tracking-eyebrow text-copper">
        {index} — {kicker}
      </p>
      <h2 className="mt-4 font-serif text-4xl leading-[1.02] text-ivory md:text-6xl">{title}</h2>
      {children ? <div className="mt-5 text-lg font-light leading-relaxed text-mist">{children}</div> : null}
    </div>
  );
}

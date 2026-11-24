export function Mark({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <ellipse cx="16" cy="16" rx="12" ry="5" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="16" cy="16" r="2.1" fill="#e3a45c" />
      <circle cx="27.2" cy="16" r="1.5" fill="#f6d7a8" />
    </svg>
  );
}

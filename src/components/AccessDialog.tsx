import { useEffect, useRef } from 'react';
import { ACCOUNTS } from '@/features/landing/data';
import { RequestForm } from '@/features/landing/RequestForm';

export function AccessDialog({ tier, onClose }: { tier: string | null; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!tier) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [tier, onClose]);

  if (!tier) return null;
  const account = ACCOUNTS.find((item) => item.id === tier);

  return (
    <div className="land-modal" onClick={onClose}>
      <div
        className="ask"
        role="dialog"
        aria-modal="true"
        aria-labelledby="access-title"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="k">First cohort</p>
        <strong id="access-title">{account ? account.name : 'Request access'}</strong>
        <RequestForm initialTier={tier} idPrefix="dialog" bare />
        <button ref={closeRef} type="button" className="link" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { connectWallet, purchase, readConnectedWallet, shortWallet } from '@/engine/accounts';
import { ACCOUNTS, RULE_LINES, usd, type AccountId } from '@/features/landing/data';
import { planById } from '@/lib/plans';

export function AccessDialog({ tier, onClose, onPurchased }: { tier: string | null; onClose: () => void; onPurchased?: (id: string) => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();
  const [planId, setPlanId] = useState<AccountId>('advanced');
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  const [wallet, setWallet] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [bought, setBought] = useState<string | null>(null);
  const chosen = tier ? planById(tier)?.id : undefined;
  if (tier !== openedFor) {
    setOpenedFor(tier);
    if (chosen) setPlanId(chosen);
    setError('');
    setBought(null);
    setBusy(false);
  }

  useEffect(() => {
    if (!tier) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    readConnectedWallet().then(setWallet).catch(() => setWallet(null));
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [tier, onClose]);

  if (!tier) return null;
  const plan = planById(planId) ?? ACCOUNTS[1];

  return (
    <div className="land-modal" onClick={onClose}>
      <div
        className="ask"
        role="dialog"
        aria-modal="true"
        aria-labelledby="access-title"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="k">Evaluation</p>
        <strong id="access-title">{bought ? `${plan.name} is open` : plan.name}</strong>
        {bought ? (
          <p className="fine">Payment simulated. This account is saved to your wallet and stays independent of any other size you buy.</p>
        ) : (
          <>
            <p className="fine">
              {usd(plan.price)} for a {usd(plan.capital)} virtual account. {RULE_LINES.join(' · ')}.
            </p>
            <label htmlFor="access-plan">Challenge</label>
            <select id="access-plan" value={planId} onChange={(event) => setPlanId(event.target.value as AccountId)}>
              {ACCOUNTS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {usd(item.price)} · {usd(item.capital)}
                </option>
              ))}
            </select>
            {wallet ? (
              <p className="fine">Wallet {shortWallet(wallet)}</p>
            ) : (
              <button
                type="button"
                className="land-go"
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  setError('');
                  connectWallet()
                    .then(setWallet)
                    .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Wallet connection failed'))
                    .finally(() => setBusy(false));
                }}
              >
                Connect wallet
              </button>
            )}
            {wallet ? (
              <button
                type="button"
                className="land-go"
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  setError('');
                  purchase(wallet, plan)
                    .then((account) => {
                      setBought(account.id);
                      onPurchased?.(account.id);
                    })
                    .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Payment failed'))
                    .finally(() => setBusy(false));
                }}
              >
                {busy ? 'Confirming…' : `Pay ${usd(plan.price)}`}
              </button>
            ) : null}
            <p className="fine">The charge is simulated. No funds move. The wallet is the account owner.</p>
          </>
        )}
        {error ? <p className="err">{error}</p> : null}
        {bought ? (
          <button
            type="button"
            className="land-go"
            onClick={() => {
              onClose();
              navigate('/app');
            }}
          >
            Open the desk
          </button>
        ) : null}
        <button ref={closeRef} type="button" className="link" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

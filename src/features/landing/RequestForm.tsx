import { useEffect, useState } from 'react';
import { TIERS } from '@/features/landing/data';
import { readInterest, saveInterest } from '@/lib/interest';

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function RequestForm({
  initialTier,
  idPrefix,
  bare = false,
}: {
  initialTier: string;
  idPrefix: string;
  bare?: boolean;
}) {
  const saved = readInterest();
  const [email, setEmail] = useState(saved?.email ?? '');
  const [tier, setTier] = useState(initialTier || saved?.tier || 'general');
  const [error, setError] = useState('');
  const [done, setDone] = useState(Boolean(saved));

  useEffect(() => {
    setTier(initialTier || 'general');
  }, [initialTier]);

  useEffect(() => {
    const sync = () => {
      const next = readInterest();
      if (!next) return;
      setEmail(next.email);
      setTier(next.tier);
      setDone(true);
    };
    window.addEventListener('orbit-interest', sync);
    return () => window.removeEventListener('orbit-interest', sync);
  }, []);

  if (done) {
    return (
      <div className={bare ? '' : 'ask'} role="status">
        <p className="k">Interest recorded</p>
        <strong>{email}</strong>
        <p className="fine">Kept in this browser. Orbit is not taking payment yet, and a request does not reserve a funded account.</p>
        <button type="button" className="link" onClick={() => setDone(false)}>
          Update the address
        </button>
      </div>
    );
  }

  return (
    <form
      className={bare ? '' : 'ask'}
      onSubmit={(event) => {
        event.preventDefault();
        if (!validEmail(email.trim())) {
          setError('Enter a valid email.');
          return;
        }
        saveInterest({ email: email.trim(), tier, at: new Date().toISOString() });
        setError('');
        setDone(true);
      }}
    >
      <label htmlFor={`${idPrefix}-email`}>Email</label>
      <input
        id={`${idPrefix}-email`}
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="you@domain.com"
      />
      <label htmlFor={`${idPrefix}-tier`}>Evaluation</label>
      <select id={`${idPrefix}-tier`} value={tier} onChange={(event) => setTier(event.target.value)}>
        {TIERS.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>
      {error ? <p className="err">{error}</p> : null}
      <button type="submit" className="land-go">
        Request the first cohort
      </button>
      <p className="fine">Simulated capital only, until a funded account is offered. This preview stores the request on this device.</p>
    </form>
  );
}

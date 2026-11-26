import { useEffect, useState } from 'react';
import { withBase } from '@/lib/base';

const LINKS = [
  { href: '/#path', label: 'Path' },
  { href: '/#strategies', label: 'Strategies' },
  { href: '/#accounts', label: 'Accounts' },
  { href: '/#rules', label: 'Rules' },
];

export function SiteHeader({ onRequest }: { onRequest?: () => void }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <header className="land-top">
      <div className="land-wrap">
        <a href={withBase('/')} className="land-mark">
          <b aria-hidden="true" />
          Sendra Orbit
        </a>
        <nav className={open ? 'land-nav is-open' : 'land-nav'} aria-label="Primary">
          {LINKS.map((link) => (
            <a key={link.href} href={withBase(link.href)} onClick={() => setOpen(false)}>
              {link.label}
            </a>
          ))}
          {onRequest ? (
            <button
              type="button"
              className="land-go land-go-menu"
              onClick={() => {
                setOpen(false);
                onRequest();
              }}
            >
              Request access
            </button>
          ) : (
            <a className="land-go land-go-menu" href={withBase('/#request')}>
              Request access
            </a>
          )}
        </nav>
        <a className="land-go land-app" href={withBase('/app')}>
          Open app
        </a>
        {onRequest ? (
          <button type="button" className="land-go land-go-top" onClick={onRequest}>
            Request access
          </button>
        ) : (
          <a className="land-go land-go-top" href={withBase('/#request')}>
            Request access
          </a>
        )}
        <button
          type="button"
          className="land-burger"
          aria-expanded={open}
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? '×' : '☰'}
        </button>
      </div>
    </header>
  );
}

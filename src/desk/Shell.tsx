import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { AccessDialog } from '@/components/AccessDialog';
import { shortWallet, statusLine } from '@/engine/accounts';
import { usd } from './format';
import { useBook } from './book';
import { applyPalette, PALETTES, readPalette, usePalette } from './palette';
import { useSession } from './session';
import './desk.css';

const GROUPS = [
  {
    label: '',
    items: [
      { to: '/app', label: 'Overview', end: true, icon: 'overview' },
      { to: '/app/evaluation', label: 'Evaluation', end: false, icon: 'evaluation' },
      { to: '/app/portfolio', label: 'Portfolio', end: false, icon: 'portfolio' },
    ],
  },
  { label: 'Trade', items: [{ to: '/app/spot', label: 'Axis', end: false, icon: 'axis' }] },
  {
    label: 'Earn',
    items: [
      { to: '/app/aave', label: 'Aave', end: false, icon: 'aave' },
      { to: '/app/liquidity', label: 'Liquidity', end: false, icon: 'liquidity' },
    ],
  },
];

const ICONS: Record<string, string> = {
  overview: 'M2.5 2.5h4.2v4.2H2.5zM9.3 2.5h4.2v4.2H9.3zM2.5 9.3h4.2v4.2H2.5zM9.3 9.3h4.2V13.5H9.3z',
  evaluation: 'M8 2.2 13.2 4.4v3.8c0 3-2.1 4.9-5.2 6.2C4.9 13.1 2.8 11.2 2.8 8.2V4.4z',
  portfolio: 'M2.5 5h11v8h-11zM2.5 8h11M6 5V3.5h4V5',
  axis: 'M2.5 12.2 5.6 8l2.5 2.3 5.4-6.2',
  aave: 'M8 2.2 13.2 5.2v5.6L8 13.8 2.8 10.8V5.2z',
  liquidity: 'M4.2 11.8c.4-2.4 1.8-3.8 3.8-3.8s3.4 1.4 3.8 3.8M3.2 8.6C4 6.2 5.8 4.8 8 4.8s4 1.4 4.8 3.8',
  fold: 'M10 3.2 5.2 8 10 12.8',
  unfold: 'M6 3.2 10.8 8 6 12.8',
};

function Icon({ name }: { name: string }) {
  return (
    <svg className="ob-ico" viewBox="0 0 16 16" aria-hidden="true">
      <path d={ICONS[name]} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function navOpen(): boolean {
  try {
    return localStorage.getItem('orbit.nav') !== 'closed';
  } catch {
    return true;
  }
}

const DOCK = [
  { to: '/app', label: 'Home', end: true },
  { to: '/app/evaluation', label: 'Evaluation', end: false },
  { to: '/app/portfolio', label: 'Portfolio', end: false },
  { to: '/app/spot', label: 'Axis', end: false },
  { to: '/app/aave', label: 'Aave', end: false },
  { to: '/app/liquidity', label: 'Liquidity', end: false },
];

function ThemeSettings() {
  const palette = usePalette();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div className="ob-settings" ref={root}>
      <button type="button" aria-expanded={open} aria-haspopup="listbox" aria-label="Theme" onClick={() => setOpen((value) => !value)}>
        <svg className="ob-ico" viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="8" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <path d="M8 1.8v1.7M8 12.5v1.7M1.8 8h1.7M12.5 8h1.7M3.6 3.6l1.2 1.2M11.2 11.2l1.2 1.2M12.4 3.6l-1.2 1.2M4.8 11.2l-1.2 1.2" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <div className="ob-settings-menu" role="listbox" aria-label="Theme">
          {PALETTES.map((item) => (
            <button
              key={item.id}
              type="button"
              role="option"
              aria-selected={palette === item.id}
              className={palette === item.id ? 'is-on' : ''}
              onClick={() => {
                applyPalette(item.id);
                setOpen(false);
              }}
            >
              <i className={`ob-swatch is-${item.id}`} />
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function crumb(pathname: string): string {
  if (pathname.endsWith('/spot')) return 'Axis';
  if (pathname.endsWith('/liquidity')) return 'Liquidity';
  if (pathname.endsWith('/aave')) return 'Aave';
  if (pathname.endsWith('/portfolio')) return 'Portfolio';
  if (pathname.endsWith('/evaluation')) return 'Evaluation';
  return 'Overview';
}

function accountLabel(name: string, capital: number, createdAt: string, peers: number): string {
  const when = peers > 1 ? ` · ${createdAt.slice(0, 10)}` : '';
  return `${name} · ${usd(capital)}${when}`;
}

export function Shell() {
  const book = useBook();
  const session = useSession();
  const palette = usePalette();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(navOpen);
  const [buy, setBuy] = useState<string | null>(null);
  useState(() => {
    document.documentElement.classList.add('ob-root');
    document.documentElement.dataset.palette = readPalette();
    return true;
  });
  const toggleNav = () => {
    setOpen((value) => {
      const next = !value;
      try { localStorage.setItem('orbit.nav', next ? 'open' : 'closed'); } catch { /* ignore */ }
      return next;
    });
  };
  useEffect(() => {
    document.title = 'Orbit';
    document.documentElement.classList.add('ob-root');
    document.documentElement.dataset.palette = palette;
    return () => {
      document.documentElement.classList.remove('ob-root');
      delete document.documentElement.dataset.palette;
    };
  }, [palette]);

  return (
    <div className={open ? 'ob' : 'ob is-rail'} data-palette={palette}>
      <aside className="ob-side">
        <div className="ob-brandbar">
          <Link className="ob-brand" to="/">
            <b className="ob-mark" aria-hidden="true" />
            <span>Orbit</span>
          </Link>
          <button type="button" className="ob-fold" aria-expanded={open} aria-label={open ? 'Collapse menu' : 'Expand menu'} onClick={toggleNav}>
            <Icon name={open ? 'fold' : 'unfold'} />
          </button>
        </div>
        {GROUPS.map((group) => (
          <nav key={group.label || 'home'} className="ob-navgroup" aria-label={group.label || 'Overview'}>
            {group.label && <p>{group.label}</p>}
            {group.items.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} title={item.label} className={({ isActive }) => `ob-nav${isActive ? ' is-on' : ''}`}>
                <Icon name={item.icon} />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        ))}
        <div className="ob-paper" title={book.account && book.ready ? `Paper equity ${usd(book.equityUsd)}` : 'Paper equity'}>
          <span>Paper equity</span>
          <b className="ob-mono">{book.account && book.ready ? usd(book.equityUsd) : '—'}</b>
        </div>
      </aside>
      <div className="ob-main">
        <header className="ob-top">
          <p className="ob-crumb">{crumb(pathname)}</p>
          <div className="ob-account">
            {session.accounts.length > 0 && (
              <label className="ob-switch">
                <select
                  aria-label="Account"
                  value={session.account?.id ?? ''}
                  onChange={(event) => session.select(event.target.value)}
                >
                  {session.accounts.map((item) => (
                    <option key={item.id} value={item.id}>
                      {accountLabel(
                        item.name,
                        item.capitalUsd,
                        item.createdAt,
                        session.accounts.filter((peer) => peer.tier === item.tier).length,
                      )}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button type="button" className="ob-btn" onClick={() => setBuy('advanced')}>
              Add accounts
            </button>
          </div>
          <div className="ob-topmeta">
            <span>Equity <b className="ob-mono">{book.account && book.ready ? usd(book.equityUsd) : '—'}</b></span>
            <span>Cash <b className="ob-mono">{book.account && book.ready ? usd(book.cashUsd) : '—'}</b></span>
          </div>
          <span className={`ob-pill${book.account?.status === 'active' ? ' is-live' : ''}${book.account?.status === 'passed' ? ' is-pass' : ''}${book.account?.status === 'failed' ? ' is-stop' : ''}`}>
            {book.account ? book.account.status : session.wallet ? shortWallet(session.wallet) : 'No wallet'}
          </span>
          <ThemeSettings />
        </header>
        {session.warning && (
          <div className="ob-warn" role="status">
            <p>{session.warning}</p>
          </div>
        )}
        {book.account && book.account.status !== 'active' && (
          <div className={book.account.status === 'passed' ? 'ob-pass' : 'ob-warn'} role="status">
            <p>{statusLine(book.account)} Open positions can still be closed.</p>
          </div>
        )}
        {book.warning && (
          <div className="ob-warn" role="status">
            <p>{book.warning}</p>
            <button type="button" onClick={book.clearWarning}>Dismiss</button>
          </div>
        )}
        <div className="ob-body">
          {!session.ready ? (
            <p className="ob-gate">Loading accounts…</p>
          ) : !session.account ? (
            <div className="ob-gate">
              <h1>No evaluation yet</h1>
              <p>Connect the wallet that bought a challenge, or start one from the landing page. Each purchase is its own account.</p>
              {!session.wallet && (
                <button type="button" className="ob-btn" onClick={() => void session.connect().catch(() => undefined)}>
                  Connect wallet
                </button>
              )}
              <Link className="ob-btn-ghost" to="/#accounts">See the challenges</Link>
            </div>
          ) : (
            <Outlet />
          )}
        </div>
        <AccessDialog
          tier={buy}
          onClose={() => setBuy(null)}
          onPurchased={async (id) => {
            await session.reload();
            session.select(id);
          }}
        />
        <nav className="ob-dock" aria-label="Desk">
          {DOCK.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => (isActive ? 'is-on' : '')}>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}

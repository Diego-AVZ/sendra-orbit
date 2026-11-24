import { withBase } from '@/lib/base';

const LINKS = [
  { href: '/#path', label: 'Path' },
  { href: '/#strategies', label: 'Strategies' },
  { href: '/#accounts', label: 'Accounts' },
  { href: '/#rules', label: 'Rules' },
];

export function SiteFooter() {
  return (
    <footer className="land-foot">
      <div className="land-wrap">
        <a href={withBase('/')} className="land-mark">
          <b aria-hidden="true" />
          Sendra Orbit
        </a>
        <nav aria-label="Footer">
          {LINKS.map((link) => (
            <a key={link.href} href={withBase(link.href)}>
              {link.label}
            </a>
          ))}
          <a href="https://sendralabs.com/">Sendra Labs</a>
        </nav>
        <span>Simulated capital. An evaluation does not guarantee a funded account.</span>
      </div>
    </footer>
  );
}

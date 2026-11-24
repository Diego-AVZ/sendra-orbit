import { SiteHeader } from '@/components/SiteHeader';
import { withBase } from '@/lib/base';

export function MissingPage() {
  return (
    <div className="land">
      <SiteHeader />
      <main className="land-sec">
        <div className="land-wrap" style={{ minHeight: '70dvh', display: 'grid', alignContent: 'center' }}>
          <p className="land-kicker">404</p>
          <h1>This page is outside the orbit.</h1>
          <div className="land-actions">
            <a className="land-go" href={withBase('/')}>
              Back to Orbit
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}

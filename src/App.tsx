import { Component, type ReactNode } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ScrollToTop } from '@/components/ScrollToTop';
import { BookProvider } from '@/desk/book';
import { SessionProvider } from '@/desk/session';
import { AaveDesk } from '@/desk/AaveDesk';
import { LiquidityDesk } from '@/desk/LiquidityDesk';
import { Evaluation } from '@/desk/Evaluation';
import { Overview } from '@/desk/Overview';
import { Portfolio } from '@/desk/Portfolio';
import { Shell } from '@/desk/Shell';
import { SpotDesk } from '@/desk/SpotDesk';
import { BriefPage } from '@/pages/BriefPage';
import { LandingPage } from '@/pages/LandingPage';
import { MissingPage } from '@/pages/MissingPage';

class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="grid min-h-svh place-items-center bg-ink px-6 text-center text-ivory">
          <div>
            <p className="font-serif text-4xl">The page stopped.</p>
            <button
              type="button"
              className="mt-6 rounded-full bg-copper px-5 py-3 text-sm font-medium text-ink"
              onClick={() => window.location.reload()}
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <ScrollToTop />
      <Boundary>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/brief" element={<BriefPage />} />
          <Route
            path="/app"
            element={
              <SessionProvider>
                <BookProvider>
                  <Shell />
                </BookProvider>
              </SessionProvider>
            }
          >
            <Route index element={<Overview />} />
            <Route path="evaluation" element={<Evaluation />} />
            <Route path="portfolio" element={<Portfolio />} />
            <Route path="spot" element={<SpotDesk />} />
            <Route path="aave" element={<AaveDesk />} />
            <Route path="liquidity" element={<LiquidityDesk />} />
          </Route>
          <Route path="*" element={<MissingPage />} />
        </Routes>
      </Boundary>
    </BrowserRouter>
  );
}

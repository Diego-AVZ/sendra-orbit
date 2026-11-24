import { Component, type ReactNode } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ScrollToTop } from '@/components/ScrollToTop';
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
          <Route path="*" element={<MissingPage />} />
        </Routes>
      </Boundary>
    </BrowserRouter>
  );
}

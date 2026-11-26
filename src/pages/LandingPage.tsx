import { useCallback, useEffect, useState } from 'react';
import { AccessDialog } from '@/components/AccessDialog';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { Accounts } from '@/features/landing/Accounts';
import { Close } from '@/features/landing/Close';
import { Hero } from '@/features/landing/Hero';
import { Infrastructure } from '@/features/landing/Infrastructure';
import { PathSection } from '@/features/landing/PathSection';
import { Rules } from '@/features/landing/Rules';
import { Strategies } from '@/features/landing/Strategies';

export function LandingPage() {
  const [request, setRequest] = useState<string | null>(null);
  const close = useCallback(() => setRequest(null), []);

  useEffect(() => {
    const root = document.querySelector('.land');
    root?.classList.add('js');
    const items = [...document.querySelectorAll('.land .reveal')];
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -6% 0px' },
    );
    items.forEach((el) => io.observe(el));
    return () => {
      io.disconnect();
      root?.classList.remove('js');
    };
  }, []);

  useEffect(() => {
    const root = document.querySelector<HTMLElement>('.land');
    if (!root) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      root.style.setProperty('--planet', '1.08');
      return;
    }
    let frame = 0;
    const update = () => {
      frame = 0;
      const y = window.scrollY;
      const range = Math.max(window.innerHeight * 0.95, 680);
      const t = Math.min(1, Math.max(0, y / range));
      const ease = 1 - (1 - t) * (1 - t);
      root.style.setProperty('--planet', (1.08 - ease * 0.14).toFixed(4));
      root.style.setProperty('--drift', `${(-ease * 28).toFixed(1)}px`);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="land">
      <a className="sr-only" href="#content">
        Skip to content
      </a>
      <SiteHeader onRequest={() => setRequest('general')} />
      <main id="content">
        <Hero onRequest={() => setRequest('general')} />
        <PathSection />
        <Strategies />
        <Accounts onRequest={setRequest} />
        <Rules />
        <Infrastructure />
        <Close onRequest={() => setRequest('general')} />
      </main>
      <SiteFooter />
      <AccessDialog tier={request} onClose={close} />
    </div>
  );
}

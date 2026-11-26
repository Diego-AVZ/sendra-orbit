import { useEffect, useMemo, useRef } from 'react';
import { withBase } from '@/lib/base';
import { usePalette, type PaletteId } from './palette';
import type { BarInterval } from './quotes';

declare global {
  interface Window {
    TradingView?: { widget: new (options: unknown) => TvWidget };
  }
}

type TvWidget = {
  remove?: () => void;
  onChartReady?: (cb: () => void) => void;
  applyOverrides?: (overrides: Record<string, string>) => void;
  chart?: () => { setResolution?: (resolution: string, cb: () => void) => void };
};

function chartColors(palette: PaletteId) {
  const node = document.querySelector('.ob');
  const style = getComputedStyle(node ?? document.documentElement);
  const pick = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
  const chart = pick('--canvas', '#070c0a');
  const grid = pick('--line', '#18241e');
  const axis = pick('--fg-muted', '#8a9a92');
  const up = pick('--up', '#3ddc97');
  const down = pick('--down', '#ff7a87');
  const overrides: Record<string, string> = {
    'paneProperties.background': chart,
    'paneProperties.backgroundType': 'solid',
    'paneProperties.backgroundGradientStartColor': chart,
    'paneProperties.backgroundGradientEndColor': chart,
    'paneProperties.vertGridProperties.color': grid,
    'paneProperties.horzGridProperties.color': grid,
    'paneProperties.separatorColor': grid,
    'paneProperties.legendProperties.showBackground': '0',
    'scalesProperties.backgroundColor': chart,
    'scalesProperties.lineColor': grid,
    'scalesProperties.textColor': axis,
    'mainSeriesProperties.candleStyle.upColor': up,
    'mainSeriesProperties.candleStyle.downColor': down,
    'mainSeriesProperties.candleStyle.borderUpColor': up,
    'mainSeriesProperties.candleStyle.borderDownColor': down,
    'mainSeriesProperties.candleStyle.wickUpColor': up,
    'mainSeriesProperties.candleStyle.wickDownColor': down,
  };
  return { chart, up, down, overrides, theme: palette === 'paper' ? 'Light' : 'Dark' };
}

const TV_INTERVAL: Record<BarInterval, string> = {
  '15m': '15',
  '1h': '60',
  '4h': '240',
  '1d': 'D',
};

const RES_TO_BINANCE: Record<string, string> = {
  '1': '1m',
  '3': '1m',
  '5': '5m',
  '15': '15m',
  '30': '15m',
  '60': '1h',
  '120': '1h',
  '240': '4h',
  '360': '4h',
  D: '1d',
  '1D': '1d',
  W: '1d',
  '1W': '1d',
};

const PAIR: Record<string, string> = {
  BTC: 'BTCUSDT',
  ETH: 'ETHUSDT',
  LINK: 'LINKUSDT',
  AAVE: 'AAVEUSDT',
  UNI: 'UNIUSDT',
};

const PRODUCT: Record<string, string> = {
  BTC: 'BTC-USD',
  ETH: 'ETH-USD',
  LINK: 'LINK-USD',
  AAVE: 'AAVE-USD',
  UNI: 'UNI-USD',
};

const SCALE: Record<string, number> = {
  BTC: 100,
  ETH: 100,
  LINK: 1000,
  AAVE: 100,
  UNI: 10000,
};

const SUPPORTED = ['1', '5', '15', '60', '240', 'D'];

type Bar = { time: number; open: number; high: number; low: number; close: number; volume: number };

function onLocalhost(): boolean {
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
}

function binanceRoot(): string {
  return onLocalhost() ? '/binance' : 'https://api.binance.com';
}

function coinbaseRoot(): string {
  return onLocalhost() ? '/coinbase' : 'https://api.exchange.coinbase.com';
}

let scriptPromise: Promise<void> | null = null;

function loadTradingView(): Promise<void> {
  if (window.TradingView?.widget) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-tv-charting-library="true"]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('The chart library failed to load.')));
      return;
    }
    const script = document.createElement('script');
    script.src = withBase('/charting_library/charting_library.standalone.js');
    script.async = true;
    script.dataset.tvChartingLibrary = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('The chart library failed to load.'));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

async function binanceBars(symbol: string, resolution: string, fromSec: number, toSec: number): Promise<Bar[]> {
  const interval = RES_TO_BINANCE[resolution] ?? '1h';
  const pair = PAIR[symbol];
  if (!pair) return [];
  const out: Bar[] = [];
  let cursor = fromSec * 1000;
  const end = toSec * 1000;
  while (cursor < end && out.length < 5000) {
    const url = `${binanceRoot()}/api/v3/klines?symbol=${pair}&interval=${interval}&startTime=${cursor}&endTime=${end}&limit=1000`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Binance ${response.status}`);
    const rows = (await response.json()) as string[][];
    if (!Array.isArray(rows) || !rows.length) break;
    for (const row of rows) {
      out.push({
        time: Number(row[0]),
        open: Number(row[1]),
        high: Number(row[2]),
        low: Number(row[3]),
        close: Number(row[4]),
        volume: Number(row[5]),
      });
    }
    const last = Number(rows[rows.length - 1][0]);
    if (rows.length < 1000 || last <= cursor) break;
    cursor = last + 1;
  }
  return out.filter((bar) => bar.close > 0);
}

async function coinbaseBars(symbol: string, resolution: string, fromSec: number, toSec: number): Promise<Bar[]> {
  const product = PRODUCT[symbol];
  if (!product) return [];
  const granularity = resolution === '15' || resolution === '5' || resolution === '1' ? 900 : resolution === '240' ? 21600 : resolution === 'D' || resolution === '1D' ? 86400 : 3600;
  const url = new URL(`${coinbaseRoot()}/products/${product}/candles`);
  url.searchParams.set('granularity', String(granularity));
  const end = Math.floor(toSec);
  let start = Math.floor(fromSec);
  if (end - start > granularity * 280) start = end - granularity * 280;
  url.searchParams.set('start', new Date(start * 1000).toISOString());
  url.searchParams.set('end', new Date(end * 1000).toISOString());
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Coinbase ${response.status}`);
  const rows = (await response.json()) as number[][];
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => ({
    time: row[0] * 1000,
    low: row[1],
    high: row[2],
    open: row[3],
    close: row[4],
    volume: row[5],
  })).filter((bar) => bar.close > 0).sort((a, b) => a.time - b.time);
}

async function loadBars(symbol: string, resolution: string, fromSec: number, toSec: number): Promise<Bar[]> {
  try {
    const bars = await binanceBars(symbol, resolution, fromSec, toSec);
    if (bars.length) return bars;
  } catch {
    /* coinbase below */
  }
  return coinbaseBars(symbol, resolution, fromSec, toSec);
}

function createFeed(coin: string) {
  const timers = new Map<string, number>();
  return {
    onReady: (cb: (config: unknown) => void) => {
      setTimeout(() => cb({
        supported_resolutions: SUPPORTED,
        supports_group_request: false,
        supports_marks: false,
        supports_timescale_marks: false,
        supports_time: true,
        supports_search: false,
      }), 0);
    },
    resolveSymbol: (symbolName: string, onResolve: (info: unknown) => void) => {
      setTimeout(() => onResolve({
        name: symbolName || coin,
        ticker: symbolName || coin,
        description: `${coin} / USD`,
        type: 'crypto',
        session: '24x7',
        timezone: 'Etc/UTC',
        exchange: '',
        listed_exchange: '',
        format: 'price',
        pricescale: SCALE[coin] ?? 100,
        minmov: 1,
        has_intraday: true,
        has_daily: true,
        has_weekly_and_monthly: false,
        supported_resolutions: SUPPORTED,
        volume_precision: 2,
        data_status: 'streaming',
      }), 0);
    },
    getBars: async (
      _info: unknown,
      resolution: string,
      period: { from: number; to: number; firstDataRequest: boolean },
      onHistory: (bars: Bar[], meta: { noData: boolean }) => void,
      onError: (reason: string) => void,
    ) => {
      try {
        const to = period.to;
        const from = period.firstDataRequest ? Math.min(period.from, to - 14 * 24 * 3600) : period.from;
        const bars = (await loadBars(coin, resolution, from, to)).filter((bar) => bar.time >= from * 1000 && bar.time <= to * 1000);
        onHistory(bars, { noData: bars.length === 0 });
      } catch (error) {
        onError(error instanceof Error ? error.message : 'Price history failed to load');
      }
    },
    subscribeBars: (_info: unknown, resolution: string, onRealtime: (bar: Bar) => void, uid: string) => {
      if (timers.has(uid)) return;
      const pull = () => {
        const now = Math.floor(Date.now() / 1000);
        loadBars(coin, resolution, now - 2 * 24 * 3600, now)
          .then((bars) => {
            const last = bars[bars.length - 1];
            if (last) onRealtime(last);
          })
          .catch(() => undefined);
      };
      pull();
      timers.set(uid, window.setInterval(pull, 5000));
    },
    unsubscribeBars: (uid: string) => {
      const timer = timers.get(uid);
      if (timer) window.clearInterval(timer);
      timers.delete(uid);
    },
  };
}

export function TvChart({ coin, interval }: { coin: string; interval: BarInterval }) {
  const host = useRef<HTMLDivElement>(null);
  const widget = useRef<TvWidget | null>(null);
  const resolution = useRef(TV_INTERVAL[interval]);
  const palette = usePalette();
  resolution.current = TV_INTERVAL[interval];
  const feed = useMemo(() => createFeed(coin), [coin]);

  useEffect(() => {
    const node = host.current;
    let cancel = false;
    loadTradingView()
      .then(() => {
        if (cancel || !node || !window.TradingView) return;
        widget.current?.remove?.();
        const colors = chartColors(palette);
        const next = new window.TradingView.widget({
          symbol: coin,
          interval: resolution.current,
          container: node,
          datafeed: feed,
          library_path: withBase('/charting_library/'),
          locale: 'en',
          theme: colors.theme,
          autosize: true,
          timezone: 'Etc/UTC',
          toolbar_bg: colors.chart,
          loading_screen: { backgroundColor: colors.chart, foregroundColor: colors.up },
          overrides: colors.overrides,
          studies_overrides: {
            'volume.volume.color.0': colors.down,
            'volume.volume.color.1': colors.up,
            'volume.volume.transparency': 55,
          },
          disabled_features: [
            'use_localstorage_for_settings',
            'header_symbol_search',
            'header_compare',
            'header_saveload',
            'header_screenshot',
            'header_resolutions',
            'timeframes_toolbar',
          ],
          enabled_features: [
            'left_toolbar',
            'keep_left_toolbar_visible_on_small_screens',
            'header_undo_redo',
            'drawing_templates',
            'side_toolbar_in_fullscreen_mode',
          ],
        });
        widget.current = next;
        next.onChartReady?.(() => {
          if (cancel) return;
          try {
            next.applyOverrides?.(colors.overrides);
            next.chart?.()?.setResolution?.(resolution.current, () => undefined);
          } catch {
            /* widget not ready */
          }
        });
      })
      .catch((error: unknown) => {
        if (!node || cancel) return;
        const message = error instanceof Error ? error.message : 'The chart failed to load';
        node.replaceChildren();
        const note = document.createElement('p');
        note.className = 'ob-chart-empty';
        note.textContent = message;
        node.appendChild(note);
      });
    return () => {
      cancel = true;
      widget.current?.remove?.();
      widget.current = null;
    };
  }, [coin, feed, palette]);

  useEffect(() => {
    try {
      widget.current?.chart?.()?.setResolution?.(TV_INTERVAL[interval], () => undefined);
    } catch {
      /* ignore until ready */
    }
  }, [interval]);

  return <div ref={host} className="ob-tv" />;
}

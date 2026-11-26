import { useEffect, useState } from 'react';
import type { Asset } from '@/engine/assets';
import type { Candle } from '@/engine/candles';
import { readDepth, readSlot } from '@/engine/chain';
import { assetPriceUsd, fetchAssetCandles, fetchLabsStats, type BarInterval, type LabsStat } from '@/engine/market';
import { humanFromSqrt } from '@/engine/units';
import { POOLS, spacingOf, type Pool } from './markets';

export type { BarInterval };

const SPAN: Record<BarInterval, number> = { '15m': 2, '1h': 7, '4h': 30, '1d': 120 };

export function useAssetQuote(asset: Asset, interval: BarInterval = '1h') {
  const [price, setPrice] = useState<number | null>(null);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPrice(null);
    setCandles([]);
    setError(null);
  }, [asset]);

  useEffect(() => {
    let cancel = false;
    const since = Math.floor(Date.now() / 1000) - SPAN[interval] * 24 * 3600;
    const loadPrice = () => {
      assetPriceUsd(asset)
        .then((next) => {
          if (!cancel) {
            setPrice(next);
            setError(null);
          }
        })
        .catch((err: unknown) => {
          if (!cancel) setError((prev) => prev ?? (err instanceof Error ? err.message : 'Price unavailable'));
        });
    };
    loadPrice();
    fetchAssetCandles(asset.symbol, since, interval)
      .then((rows) => {
        if (cancel) return;
        setCandles(rows);
        const last = rows.at(-1)?.close;
        if (last && last > 0) setPrice((current) => current ?? last);
        if (!rows.length) setError('No candles for this market');
      })
      .catch((err: unknown) => {
        if (!cancel) setError(err instanceof Error ? err.message : 'Candles unavailable');
      });
    const id = window.setInterval(loadPrice, 15_000);
    return () => {
      cancel = true;
      window.clearInterval(id);
    };
  }, [asset, interval]);

  return { price, candles, error };
}

export type PoolQuote = {
  price: number;
  price0Usd: number;
  price1Usd: number;
  candles: Candle[];
};

export type DepthPoint = { price: number; size: number };

function ratioCandles(numer: Candle[] | null, denom: Candle[] | null): Candle[] {
  if (!numer?.length && !denom?.length) return [];
  if (!denom?.length) return numer ?? [];
  if (!numer?.length) {
    return denom.map((candle) => ({
      time: candle.time,
      open: candle.open > 0 ? 1 / candle.open : 0,
      high: candle.low > 0 ? 1 / candle.low : 0,
      low: candle.high > 0 ? 1 / candle.high : 0,
      close: candle.close > 0 ? 1 / candle.close : 0,
      volumeUsd: candle.volumeUsd,
    })).filter((candle) => candle.close > 0);
  }
  const byTime = new Map(denom.map((candle) => [candle.time, candle]));
  const rows: Candle[] = [];
  for (const candle of numer) {
    const other = byTime.get(candle.time);
    if (!other || !(other.open > 0) || !(other.close > 0) || !(other.high > 0) || !(other.low > 0)) continue;
    const open = candle.open / other.open;
    const close = candle.close / other.close;
    rows.push({
      time: candle.time,
      open,
      close,
      high: Math.max(candle.high / other.low, candle.low / other.high, open, close),
      low: Math.min(candle.low / other.high, candle.high / other.low, open, close),
      volumeUsd: candle.volumeUsd,
    });
  }
  return rows;
}

function syntheticDepth(price: number): DepthPoint[] {
  const rows: DepthPoint[] = [];
  for (let step = -32; step <= 32; step += 1) {
    rows.push({
      price: price * Math.exp(step * 0.008),
      size: Math.exp(-(step * step) / 140),
    });
  }
  return rows;
}

function isStable(symbol: string): boolean {
  return symbol === 'USDC' || symbol === 'USDT';
}

async function usdOf(asset: Asset): Promise<number> {
  if (isStable(asset.symbol)) return 1;
  return assetPriceUsd(asset);
}

export function useLabsStats() {
  const [stats, setStats] = useState<LabsStat[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancel = false;
    fetchLabsStats(POOLS.map((pool) => pool.pool))
      .then((rows) => {
        if (!cancel) setStats(rows);
      })
      .catch(() => {
        if (!cancel) setFailed(true);
      });
    return () => {
      cancel = true;
    };
  }, []);

  return { stats, failed };
}

export function usePoolQuote(pool: Pool | null) {
  const [prices, setPrices] = useState<Omit<PoolQuote, 'candles'> | null>(null);
  const [hourly, setHourly] = useState<Candle[]>([]);
  const [daily, setDaily] = useState<Candle[]>([]);
  const [depth, setDepth] = useState<DepthPoint[]>([]);
  const [depthLive, setDepthLive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!pool) {
      setPrices(null);
      setHourly([]);
      setDaily([]);
      setDepth([]);
      setDepthLive(false);
      return;
    }
    let cancel = false;
    setPrices(null);
    setHourly([]);
    setDaily([]);
    setDepth([]);
    setDepthLive(false);
    setError(null);
    const loadPrice = async () => {
      const slot = await readSlot(pool.pool);
      const [price0Usd, price1Usd] = await Promise.all([usdOf(pool.token0), usdOf(pool.token1)]);
      return {
        price: humanFromSqrt(slot.sqrtPriceX96, pool.token0.decimals, pool.token1.decimals),
        price0Usd,
        price1Usd,
      };
    };
    loadPrice()
      .then((next) => {
        if (cancel) return;
        setPrices(next);
        setError(null);
        return readDepth(pool.pool, spacingOf(pool.feePips), pool.token0.decimals, pool.token1.decimals)
          .then((bins) => {
            if (cancel) return;
            setDepth(bins.map((bin) => ({ price: bin.price, size: bin.size })));
            setDepthLive(true);
          })
          .catch(() => {
            if (!cancel) setDepthLive(false);
          });
      })
      .catch((err: unknown) => {
        if (!cancel) setError(err instanceof Error ? err.message : 'Pool unavailable');
      });
    const loadRatio = (sinceSec: number, interval: BarInterval) => {
      const legs = [pool.token0, pool.token1].filter((token) => !isStable(token.symbol));
      return Promise.all(legs.map((token) => fetchAssetCandles(token.symbol, sinceSec, interval).catch(() => [] as Candle[])))
        .then((series) => {
          const bySymbol = new Map(legs.map((token, index) => [token.symbol, series[index]]));
          const numer = isStable(pool.token0.symbol) ? null : bySymbol.get(pool.token0.symbol) ?? [];
          const denom = isStable(pool.token1.symbol) ? null : bySymbol.get(pool.token1.symbol) ?? [];
          return ratioCandles(numer, denom);
        });
    };
    const now = Math.floor(Date.now() / 1000);
    loadRatio(now - 40 * 86_400, '1h').then((rows) => { if (!cancel) setHourly(rows); }).catch(() => undefined);
    loadRatio(now - 210 * 86_400, '1d').then((rows) => { if (!cancel) setDaily(rows); }).catch(() => undefined);
    const id = window.setInterval(() => {
      loadPrice()
        .then((next) => {
          if (!cancel) setPrices(next);
        })
        .catch(() => undefined);
    }, 20_000);
    return () => {
      cancel = true;
      window.clearInterval(id);
    };
  }, [pool]);

  const quote = prices ? { ...prices, candles: daily } : null;
  const shown = depth.length > 0 ? depth : prices && prices.price > 0 ? syntheticDepth(prices.price) : [];
  return { quote, depth: shown, depthLive, error, hourly, daily };
}

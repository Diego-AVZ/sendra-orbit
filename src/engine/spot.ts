import { isSpotAsset, type Asset } from './assets';
import { sortCandles, type Candle } from './candles';
import type { Mark } from './lp';
import { amountUsd, maxDrawdown, money, swapRaw } from './units';

export type SpotSnapshot = {
  asset: string;
  symbol: string;
  decimals: number;
  tokens: bigint;
  principalUsdc: bigint;
  principalUsd: number;
  entryPriceUsd: number;
  feeBps: number;
  gasUsd: number;
  entryEquityUsd: number;
};

export type SpotOpenInput = {
  asset: Asset;
  principalUsdc: bigint;
  priceUsd: number;
  feeBps?: number;
  gasUsd?: number;
};

export type SpotQuote = {
  at: string;
  priceUsd: number;
  candles?: Candle[];
  gasUsd?: number;
};

const USDC = { decimals: 6, priceUsd: 1 };

export function openSpot(input: SpotOpenInput): SpotSnapshot {
  if (!isSpotAsset(input.asset)) throw new Error('spot asset is not one Sendra trades');
  if (input.principalUsdc <= 0n || !(input.priceUsd > 0)) throw new Error('principal');
  const feeBps = input.feeBps ?? 30;
  const tokens = swapRaw(input.principalUsdc, USDC, { decimals: input.asset.decimals, priceUsd: input.priceUsd }, feeBps);
  const entryEquityUsd = money(amountUsd(tokens, input.asset.decimals, input.priceUsd));
  return {
    asset: input.asset.address.toLowerCase(),
    symbol: input.asset.symbol,
    decimals: input.asset.decimals,
    tokens,
    principalUsdc: input.principalUsdc,
    principalUsd: amountUsd(input.principalUsdc, 6, 1),
    entryPriceUsd: input.priceUsd,
    feeBps,
    gasUsd: input.gasUsd ?? 0,
    entryEquityUsd,
  };
}

export function markSpot(snapshot: SpotSnapshot, quote: SpotQuote): Mark {
  if (!(quote.priceUsd > 0)) throw new Error('price');
  const gross = swapRaw(snapshot.tokens, { decimals: snapshot.decimals, priceUsd: quote.priceUsd }, USDC, snapshot.feeBps);
  const equity = amountUsd(gross, 6, 1);
  const candles = quote.candles ? sortCandles(quote.candles) : [];
  const path = candles.map((candle) => {
    const out = swapRaw(snapshot.tokens, { decimals: snapshot.decimals, priceUsd: candle.close }, USDC, snapshot.feeBps);
    return amountUsd(out, 6, 1);
  });
  return {
    at: quote.at,
    equityUsd: money(equity),
    pnlUsd: money(equity - snapshot.principalUsd - snapshot.gasUsd - (quote.gasUsd ?? 0)),
    feesUsd: money(snapshot.principalUsd - snapshot.entryEquityUsd + (amountUsd(snapshot.tokens, snapshot.decimals, quote.priceUsd) - equity)),
    interestUsd: 0,
    impermanentLossUsd: null,
    inRange: null,
    timeInRangeSeconds: null,
    healthFactor: null,
    liquidated: false,
    liquidationPriceUsd: null,
    maxDrawdownUsd: maxDrawdown([snapshot.entryEquityUsd, ...path, equity]),
    price: quote.priceUsd,
  };
}

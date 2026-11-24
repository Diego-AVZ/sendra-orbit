import { feesFromCandles, liquidityShare, sortCandles, type Candle } from './candles';
import { depositFromToken1, dilute, feesOwed, getAmountsForLiquidity } from './liquidity';
import { assertRange, humanAtTick, inRange, sqrtAtHuman, sqrtPriceAtTick } from './tick';
import { amountUsd, maxDrawdown, money, token1Cost } from './units';

export const USDC = '0xaf88d065e77c8cc2239327c5edb3a432268e5831';

export type LpSnapshot = {
  pool: string;
  token0: string;
  token1: string;
  decimals0: number;
  decimals1: number;
  feePips: number;
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
  amount0: bigint;
  amount1: bigint;
  poolLiquidity: bigint;
  feeGrowth0: bigint;
  feeGrowth1: bigint;
  sqrtPrice: bigint;
  entryPrice: number;
  price0Usd: number;
  price1Usd: number;
  principalUsd: number;
  entryEquityUsd: number;
  gasUsd: number;
  swapFeeBps: number;
};

export type LpOpenInput = {
  pool: string;
  token0: string;
  token1: string;
  decimals0: number;
  decimals1: number;
  feePips: number;
  tickLower: number;
  tickUpper: number;
  budgetToken1: bigint;
  sqrtPriceX96: bigint;
  poolLiquidity: bigint;
  feeGrowth0?: bigint;
  feeGrowth1?: bigint;
  price0Usd: number;
  price1Usd: number;
  swapFeeBps?: number;
  gasUsd?: number;
};

export type LpQuote = {
  at: string;
  sqrtPriceX96?: bigint;
  priceToken1Per0?: number;
  price0Usd: number;
  price1Usd: number;
  poolLiquidity?: bigint;
  feeGrowth0?: bigint;
  feeGrowth1?: bigint;
  candles?: Candle[];
  candleSeconds?: number;
  gasUsd?: number;
  realize?: boolean;
};

export type Mark = {
  at: string;
  equityUsd: number;
  pnlUsd: number;
  feesUsd: number;
  interestUsd: number;
  impermanentLossUsd: number | null;
  inRange: boolean | null;
  timeInRangeSeconds: number | null;
  healthFactor: number | null;
  liquidated: boolean;
  liquidationPriceUsd: number | null;
  maxDrawdownUsd: number;
  price: number | null;
};

export function openLp(input: LpOpenInput): LpSnapshot {
  assertRange(input.feePips, input.tickLower, input.tickUpper);
  if (input.sqrtPriceX96 <= 0n) throw new Error('price');
  const sqrtA = sqrtPriceAtTick(input.tickLower);
  const sqrtB = sqrtPriceAtTick(input.tickUpper);
  const deposited = depositFromToken1(
    input.sqrtPriceX96,
    sqrtA,
    sqrtB,
    input.budgetToken1,
    input.swapFeeBps ?? 0,
  );
  const equity =
    amountUsd(deposited.amount0, input.decimals0, input.price0Usd) +
    amountUsd(deposited.amount1, input.decimals1, input.price1Usd);
  return {
    pool: input.pool.toLowerCase(),
    token0: input.token0.toLowerCase(),
    token1: input.token1.toLowerCase(),
    decimals0: input.decimals0,
    decimals1: input.decimals1,
    feePips: input.feePips,
    tickLower: input.tickLower,
    tickUpper: input.tickUpper,
    liquidity: deposited.liquidity,
    amount0: deposited.amount0,
    amount1: deposited.amount1,
    poolLiquidity: input.poolLiquidity,
    feeGrowth0: input.feeGrowth0 ?? 0n,
    feeGrowth1: input.feeGrowth1 ?? 0n,
    sqrtPrice: input.sqrtPriceX96,
    entryPrice: humanAtTick(
      nearest(input.sqrtPriceX96, input.decimals0, input.decimals1),
      input.decimals0,
      input.decimals1,
    ),
    price0Usd: input.price0Usd,
    price1Usd: input.price1Usd,
    principalUsd: amountUsd(input.budgetToken1, input.decimals1, input.price1Usd),
    entryEquityUsd: money(equity),
    gasUsd: input.gasUsd ?? 0,
    swapFeeBps: input.swapFeeBps ?? 0,
  };
}

function nearest(sqrtPrice: bigint, decimals0: number, decimals1: number): number {
  const human = humanPrice(sqrtPrice, decimals0, decimals1);
  return Math.round(Math.log(human * 10 ** (decimals1 - decimals0)) / Math.log(1.0001));
}

export function humanPrice(sqrtPrice: bigint, decimals0: number, decimals1: number): number {
  const { humanFromSqrt } = requireHuman();
  return humanFromSqrt(sqrtPrice, decimals0, decimals1);
}

function requireHuman(): { humanFromSqrt: typeof import('./units').humanFromSqrt } {
  return { humanFromSqrt: (sqrt, d0, d1) => importHuman(sqrt, d0, d1) };
}

function importHuman(sqrtPrice: bigint, decimals0: number, decimals1: number): number {
  const shift = decimals0 - decimals1;
  let numerator = sqrtPrice * sqrtPrice;
  let denominator = (1n << 96n) * (1n << 96n);
  if (shift >= 0) numerator *= 10n ** BigInt(shift);
  else denominator *= 10n ** BigInt(-shift);
  return Number((numerator * 10n ** 8n) / denominator) / 1e8;
}

export function markLp(snapshot: LpSnapshot, quote: LpQuote): Mark {
  const sqrtPrice = quote.sqrtPriceX96 ?? (quote.priceToken1Per0 ? sqrtAtHuman(quote.priceToken1Per0, snapshot.decimals0, snapshot.decimals1) : null);
  if (sqrtPrice == null) throw new Error('price');
  const sqrtA = sqrtPriceAtTick(snapshot.tickLower);
  const sqrtB = sqrtPriceAtTick(snapshot.tickUpper);
  const amounts = getAmountsForLiquidity(sqrtPrice, sqrtA, sqrtB, snapshot.liquidity);
  const value =
    amountUsd(amounts.amount0, snapshot.decimals0, quote.price0Usd) +
    amountUsd(amounts.amount1, snapshot.decimals1, quote.price1Usd);
  const hodl =
    amountUsd(snapshot.amount0, snapshot.decimals0, quote.price0Usd) +
    amountUsd(snapshot.amount1, snapshot.decimals1, quote.price1Usd);
  const growthFees = growthFeeUsd(snapshot, quote);
  const lower = humanAtTick(snapshot.tickLower, snapshot.decimals0, snapshot.decimals1);
  const upper = humanAtTick(snapshot.tickUpper, snapshot.decimals0, snapshot.decimals1);
  const share = liquidityShare(snapshot.liquidity, quote.poolLiquidity ?? snapshot.poolLiquidity);
  const candles = quote.candles ? sortCandles(quote.candles) : [];
  const candleFees = candles.length
    ? feesFromCandles(candles, lower, upper, snapshot.feePips, share, quote.candleSeconds ?? 3600)
    : null;
  const feesUsd = growthFees ?? candleFees?.feesUsd ?? 0;
  const active = inRange(sqrtPrice, sqrtA, sqrtB);
  const exit = quote.realize ? exitFeeUsd(snapshot, amounts, quote) : 0;
  const equity = value + feesUsd - exit;
  const path = pathEquity(snapshot, candles, quote, lower, upper, share, growthFees);
  return {
    at: quote.at,
    equityUsd: money(equity),
    pnlUsd: money(equity - snapshot.principalUsd - snapshot.gasUsd - (quote.gasUsd ?? 0)),
    feesUsd: money(feesUsd),
    interestUsd: 0,
    impermanentLossUsd: money(value - hodl),
    inRange: active,
    timeInRangeSeconds: candleFees ? Math.round(candleFees.secondsInRange) : null,
    healthFactor: null,
    liquidated: false,
    liquidationPriceUsd: null,
    maxDrawdownUsd: maxDrawdown([snapshot.entryEquityUsd, ...path, equity]),
    price: money(importHuman(sqrtPrice, snapshot.decimals0, snapshot.decimals1)),
  };
}

function growthFeeUsd(snapshot: LpSnapshot, quote: LpQuote): number | null {
  if (quote.feeGrowth0 == null || quote.feeGrowth1 == null) return null;
  const pool = quote.poolLiquidity ?? snapshot.poolLiquidity;
  const fee0 = dilute(feesOwed(snapshot.liquidity, quote.feeGrowth0, snapshot.feeGrowth0), pool, snapshot.liquidity);
  const fee1 = dilute(feesOwed(snapshot.liquidity, quote.feeGrowth1, snapshot.feeGrowth1), pool, snapshot.liquidity);
  return amountUsd(fee0, snapshot.decimals0, quote.price0Usd) + amountUsd(fee1, snapshot.decimals1, quote.price1Usd);
}

function exitFeeUsd(
  snapshot: LpSnapshot,
  amounts: { amount0: bigint; amount1: bigint },
  quote: LpQuote,
): number {
  const fee = snapshot.swapFeeBps / 10_000;
  let cost = 0;
  if (snapshot.token0 !== USDC) cost += amountUsd(amounts.amount0, snapshot.decimals0, quote.price0Usd) * fee;
  if (snapshot.token1 !== USDC) cost += amountUsd(amounts.amount1, snapshot.decimals1, quote.price1Usd) * fee;
  return cost;
}

function pathEquity(
  snapshot: LpSnapshot,
  candles: Candle[],
  quote: LpQuote,
  lower: number,
  upper: number,
  share: number,
  growthFees: number | null,
): number[] {
  if (!candles.length) return [];
  const walked = feesFromCandles(candles, lower, upper, snapshot.feePips, share, quote.candleSeconds ?? 3600);
  const aligned = align(walked.cumulative, growthFees);
  return candles.map((candle, index) => {
    const sqrtPrice = sqrtAtHuman(candle.close, snapshot.decimals0, snapshot.decimals1);
    const amounts = getAmountsForLiquidity(sqrtPrice, sqrtPriceAtTick(snapshot.tickLower), sqrtPriceAtTick(snapshot.tickUpper), snapshot.liquidity);
    const price0 = candle.close * quote.price1Usd;
    const value = amountUsd(amounts.amount0, snapshot.decimals0, price0) + amountUsd(amounts.amount1, snapshot.decimals1, quote.price1Usd);
    return value + (aligned[index] ?? 0);
  });
}

function align(cumulative: number[], growthFees: number | null): number[] {
  if (growthFees == null) return cumulative;
  const last = cumulative[cumulative.length - 1] ?? 0;
  if (last <= 0) return cumulative.map((_, index) => (index === cumulative.length - 1 ? growthFees : 0));
  return cumulative.map((fee) => (fee / last) * growthFees);
}

export function unspentToken1(snapshot: LpSnapshot): bigint {
  return token1Cost(snapshot.amount0, snapshot.sqrtPrice) + snapshot.amount1;
}

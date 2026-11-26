export const Q96 = 1n << 96n;
export const Q128 = 1n << 128n;
export const RAY = 10n ** 27n;
export const YEAR = 31_536_000n;
const HALF_RAY = RAY / 2n;
const MASK256 = (1n << 256n) - 1n;

export function sub256(a: bigint, b: bigint): bigint {
  return (a - b) & MASK256;
}

export function rawToHuman(amount: bigint, decimals: number): number {
  const negative = amount < 0n;
  const value = negative ? -amount : amount;
  const scale = 10n ** BigInt(decimals);
  const human = Number(value / scale) + Number(value % scale) / Number(scale);
  return negative ? -human : human;
}

export function price8(usd: number): bigint {
  if (!Number.isFinite(usd) || usd < 0) throw new Error('price');
  return BigInt(Math.round(usd * 1e8));
}

export function money(value: number): number {
  if (!Number.isFinite(value)) return value;
  return Math.round(value * 1e8) / 1e8;
}

/** USDC of 6 decimals. Negative equity is a zero payout. */
export function usdcRaw(usd: number): bigint {
  if (!Number.isFinite(usd)) throw new Error('usdc');
  if (usd <= 0) return 0n;
  return BigInt(Math.round(usd * 1_000_000));
}

export function amountUsd(amount: bigint, decimals: number, priceUsd: number): number {
  return rawToHuman(amount, decimals) * priceUsd;
}

/** token1 raw paid for `amount0` at a sqrt price. */
export function token1Cost(amount0: bigint, sqrtPrice: bigint): bigint {
  return (amount0 * sqrtPrice) / Q96 * sqrtPrice / Q96;
}

export function humanFromSqrt(sqrtPrice: bigint, decimals0: number, decimals1: number): number {
  const shift = decimals0 - decimals1;
  let numerator = sqrtPrice * sqrtPrice;
  let denominator = Q96 * Q96;
  if (shift >= 0) numerator *= 10n ** BigInt(shift);
  else denominator *= 10n ** BigInt(-shift);
  const scale = 10n ** 8n;
  return Number((numerator * scale) / denominator) / 1e8;
}

export function swapRaw(
  amountIn: bigint,
  from: { decimals: number; priceUsd: number },
  to: { decimals: number; priceUsd: number },
  feeBps: number,
): bigint {
  if (from.priceUsd <= 0 || to.priceUsd <= 0) throw new Error('price');
  if (feeBps < 0 || feeBps >= 10_000) throw new Error('fee');
  const value8 = (amountIn * price8(from.priceUsd)) / 10n ** BigInt(from.decimals);
  const net = (value8 * BigInt(10_000 - feeBps)) / 10_000n;
  return (net * 10n ** BigInt(to.decimals)) / price8(to.priceUsd);
}

function rayMul(a: bigint, b: bigint): bigint {
  return (a * b + HALF_RAY) / RAY;
}

/** Aave supply index. Linear between reserve updates. */
export function liquidityIndexAfter(index: bigint, rate: bigint, seconds: number): bigint {
  if (seconds <= 0) return index;
  const linear = RAY + (rate * BigInt(Math.floor(seconds))) / YEAR;
  return rayMul(index, linear);
}

/** Aave variable debt index. Compounded Taylor expansion used by the protocol. */
export function borrowIndexAfter(index: bigint, rate: bigint, seconds: number): bigint {
  if (seconds <= 0) return index;
  const exp = BigInt(Math.floor(seconds));
  const expMinusOne = exp - 1n;
  const expMinusTwo = exp > 2n ? exp - 2n : 0n;
  const basePowerTwo = rayMul(rate, rate) / (YEAR * YEAR);
  const basePowerThree = rayMul(basePowerTwo, rate) / YEAR;
  const second = (exp * expMinusOne * basePowerTwo) / 2n;
  const third = (exp * expMinusOne * expMinusTwo * basePowerThree) / 6n;
  const compounded = RAY + (rate * exp) / YEAR + second + third;
  return rayMul(index, compounded);
}

export function maxDrawdown(equities: number[]): number {
  let peak = equities[0] ?? 0;
  let drop = 0;
  for (const equity of equities) {
    if (equity > peak) peak = equity;
    if (peak - equity > drop) drop = peak - equity;
  }
  return money(drop);
}

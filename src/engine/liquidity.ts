import { Q96, Q128, sub256, token1Cost } from './units';

function order(sqrtA: bigint, sqrtB: bigint): [bigint, bigint] {
  return sqrtA > sqrtB ? [sqrtB, sqrtA] : [sqrtA, sqrtB];
}

function mulDiv(a: bigint, b: bigint, denominator: bigint): bigint {
  return (a * b) / denominator;
}

export function getLiquidityForAmount0(sqrtA: bigint, sqrtB: bigint, amount0: bigint): bigint {
  const [left, right] = order(sqrtA, sqrtB);
  const intermediate = mulDiv(left, right, Q96);
  return mulDiv(amount0, intermediate, right - left);
}

export function getLiquidityForAmount1(sqrtA: bigint, sqrtB: bigint, amount1: bigint): bigint {
  const [left, right] = order(sqrtA, sqrtB);
  return mulDiv(amount1, Q96, right - left);
}

export function getLiquidityForAmounts(
  sqrtPrice: bigint,
  sqrtA: bigint,
  sqrtB: bigint,
  amount0: bigint,
  amount1: bigint,
): bigint {
  const [left, right] = order(sqrtA, sqrtB);
  if (sqrtPrice <= left) return getLiquidityForAmount0(left, right, amount0);
  if (sqrtPrice >= right) return getLiquidityForAmount1(left, right, amount1);
  const liquidity0 = getLiquidityForAmount0(sqrtPrice, right, amount0);
  const liquidity1 = getLiquidityForAmount1(left, sqrtPrice, amount1);
  return liquidity0 < liquidity1 ? liquidity0 : liquidity1;
}

export function getAmount0ForLiquidity(sqrtA: bigint, sqrtB: bigint, liquidity: bigint): bigint {
  const [left, right] = order(sqrtA, sqrtB);
  return mulDiv(liquidity << 96n, right - left, right) / left;
}

export function getAmount1ForLiquidity(sqrtA: bigint, sqrtB: bigint, liquidity: bigint): bigint {
  const [left, right] = order(sqrtA, sqrtB);
  return mulDiv(liquidity, right - left, Q96);
}

export function getAmountsForLiquidity(
  sqrtPrice: bigint,
  sqrtA: bigint,
  sqrtB: bigint,
  liquidity: bigint,
): { amount0: bigint; amount1: bigint } {
  const [left, right] = order(sqrtA, sqrtB);
  if (sqrtPrice <= left) return { amount0: getAmount0ForLiquidity(left, right, liquidity), amount1: 0n };
  if (sqrtPrice >= right) return { amount0: 0n, amount1: getAmount1ForLiquidity(left, right, liquidity) };
  return {
    amount0: getAmount0ForLiquidity(sqrtPrice, right, liquidity),
    amount1: getAmount1ForLiquidity(left, sqrtPrice, liquidity),
  };
}

export function feesOwed(liquidity: bigint, growthNow: bigint, growthThen: bigint): bigint {
  return (liquidity * sub256(growthNow, growthThen)) / Q128;
}

/** Share of observed fee growth after adding our liquidity to the pool that produced it. */
export function dilute(fee: bigint, poolLiquidity: bigint, userLiquidity: bigint): bigint {
  if (fee === 0n || userLiquidity === 0n) return 0n;
  if (poolLiquidity === 0n) return fee;
  return (fee * poolLiquidity) / (poolLiquidity + userLiquidity);
}

export type Deposit = {
  liquidity: bigint;
  amount0: bigint;
  amount1: bigint;
  spent1: bigint;
  fee1: bigint;
};

/**
 * Spend a token1 budget on a range. Swap fee is charged on the token1 used to buy token0.
 * Amounts round down the way Uniswap does, and the spend never exceeds the budget.
 */
export function depositFromToken1(
  sqrtPrice: bigint,
  sqrtA: bigint,
  sqrtB: bigint,
  budget1: bigint,
  swapFeeBps = 0,
): Deposit {
  if (budget1 <= 0n) throw new Error('budget');
  if (swapFeeBps < 0 || swapFeeBps >= 10_000) throw new Error('fee');
  const [left, right] = order(sqrtA, sqrtB);
  let liquidity: bigint;
  if (sqrtPrice <= left) {
    const amount0 = (budget1 * Q96) / sqrtPrice * Q96 / sqrtPrice;
    liquidity = getLiquidityForAmount0(left, right, amount0);
  } else if (sqrtPrice >= right) {
    liquidity = getLiquidityForAmount1(left, right, budget1);
  } else {
    const term = (sqrtPrice * (right - sqrtPrice)) / right + (sqrtPrice - left);
    if (term <= 0n) throw new Error('range');
    liquidity = (budget1 * Q96) / term;
  }

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const got = getAmountsForLiquidity(sqrtPrice, left, right, liquidity);
    const cost0 = token1Cost(got.amount0, sqrtPrice);
    const fee1 = (cost0 * BigInt(swapFeeBps)) / 10_000n;
    const spent = cost0 + fee1 + got.amount1;
    if (spent <= budget1) {
      return { liquidity, amount0: got.amount0, amount1: got.amount1, spent1: cost0 + got.amount1, fee1 };
    }
    const cut = (liquidity * (spent - budget1)) / spent;
    liquidity -= cut > 0n ? cut : 1n;
    if (liquidity <= 0n) break;
  }
  throw new Error('deposit did not fit the budget');
}

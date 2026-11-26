import { openAave, sized, type Reserve } from './aave';
import { USDC, WETH, type Asset } from './assets';
import { feesFromCandles } from './candles';
import { feesOwed, dilute } from './liquidity';
import { markLp, openLp, usdPricesMatchPool } from './lp';
import { closePosition, createLp, fromRow, toRow } from './position';
import { openSpot, markSpot } from './spot';
import { MAX_SQRT_PRICE, MIN_SQRT_PRICE, sqrtAtHuman, sqrtPriceAtTick, tickAtHuman } from './tick';
import { RAY, liquidityIndexAfter, YEAR } from './units';

function check(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function near(actual: number, expected: number, tolerance: number, message: string) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${message}: ${actual} vs ${expected}`);
  }
}

check(sqrtPriceAtTick(0) === 1n << 96n, 'tick 0');
check(sqrtPriceAtTick(-887272) === MIN_SQRT_PRICE, 'min tick');
check(sqrtPriceAtTick(887272) === MAX_SQRT_PRICE, 'max tick');
check(sized(800n * 10n ** 8n, 10n ** 8n, 6, 5000) === 400n * 10n ** 6n, 'borrow size');

const inside = feesFromCandles(
  [{ time: 0, open: 100, high: 110, low: 90, close: 100, volumeUsd: 1_000_000 }],
  80,
  120,
  3000,
  0.5,
  3600,
);
near(inside.feesUsd, 1500, 1e-6, 'fee inside the range');
const outside = feesFromCandles(
  [{ time: 0, open: 10, high: 12, low: 9, close: 11, volumeUsd: 1_000_000 }],
  80,
  120,
  3000,
  0.5,
  3600,
);
check(outside.feesUsd === 0, 'fee outside the range');

const usdc = reserve(USDC, 1, 8000, 8500);
const eth = reserve(WETH, 3000, 8000, 8250);
const loop = openAave({
  kind: 6,
  principalUsdc: 1_000_000_000n,
  asset: WETH,
  reserves: [usdc, eth],
  loops: 1,
  borrowBps: 5000,
  swapFeeBps: 0,
  openedAt: '2026-01-01T00:00:00.000Z',
});
near(loop.entryEquityUsd, 1000, 0.05, 'loop opens flat');
check(loop.debt[0].amount > 399_000_000n && loop.debt[0].amount <= 400_000_000n, `loop debt ${loop.debt[0].amount}`);

const { markAave } = await import('./aave');
const marked = markAave(loop, { at: '2026-01-02T00:00:00.000Z', seconds: 0, prices: { [WETH.address]: 1500, [USDC.address]: 1 } });
near(marked.pnlUsd, -700, 0.5, 'loop pnl after the drop');
near(marked.healthFactor ?? 0, 1.44375, 0.02, 'health factor');
check(marked.liquidated === false, 'not liquidated');
const broken = markAave(loop, { at: '2026-01-02T00:00:00.000Z', seconds: 0, prices: { [WETH.address]: 500, [USDC.address]: 1 } });
check(broken.liquidated, 'liquidated');
const staleCandle = markAave(loop, {
  at: '2026-01-02T00:00:00.000Z',
  seconds: 0,
  prices: { [WETH.address]: 1500, [USDC.address]: 1 },
  candles: [{ time: 0, open: 100, high: 100, low: 100, close: 100, volumeUsd: 0 }],
});
check(staleCandle.price === 1500, 'oracle price survives a stale candle');
check(staleCandle.liquidated === false, 'stale candle does not liquidate');

const supplied = openAave({
  kind: 5,
  principalUsdc: 1_000_000_000n,
  asset: USDC,
  reserves: [{ ...usdc, liquidityRate: 5n * 10n ** 25n }],
  swapFeeBps: 0,
  openedAt: '2026-01-01T00:00:00.000Z',
});
const year = markAave(supplied, { at: '2027-01-01T00:00:00.000Z', seconds: Number(YEAR) });
near(year.pnlUsd, 50, 0.01, 'supply interest');
check(liquidityIndexAfter(RAY, 5n * 10n ** 25n, Number(YEAR)) > RAY, 'index grows');

const spot = openSpot({ asset: WETH, principalUsdc: 3_000_000_000n, priceUsd: 3000, feeBps: 0 });
check(spot.tokens === 10n ** 18n, 'one ether');
const sold = markSpot(spot, { at: '2026-01-02T00:00:00.000Z', priceUsd: 3300 });
near(sold.pnlUsd, 300, 0.01, 'spot pnl');

const tick = tickAtHuman(3000, 18, 6);
const spacing = 60;
const center = Math.round(tick / spacing) * spacing;
const sqrtPrice = sqrtAtHuman(3000, 18, 6);
const lp = openLp({
  pool: '0xpool',
  token0: WETH.address,
  token1: USDC.address,
  decimals0: 18,
  decimals1: 6,
  feePips: 3000,
  tickLower: center - spacing * 20,
  tickUpper: center + spacing * 20,
  budgetToken1: 1_000_000_000n,
  sqrtPriceX96: sqrtPrice,
  poolLiquidity: 10n ** 24n,
  price0Usd: 3000,
  price1Usd: 1,
  swapFeeBps: 0,
});
near(lp.entryEquityUsd, 1000, 5, 'lp budget is conserved');
const delta = (1_000_000n << 128n) / lp.liquidity;
const earned = markLp(lp, {
  at: '2026-01-02T00:00:00.000Z',
  sqrtPriceX96: sqrtPrice,
  price0Usd: 3000,
  price1Usd: 1,
  poolLiquidity: 10n ** 24n,
  feeGrowth0: 0n,
  feeGrowth1: delta,
});
near(earned.feesUsd, 1, 0.05, 'fee growth');
check((earned.impermanentLossUsd ?? 0) === 0, 'no il at the entry price');
check(usdPricesMatchPool(sqrtPrice, 18, 6, 3000, 1), 'usd prices follow the pool');
check(!usdPricesMatchPool(sqrtPrice, 18, 6, 1, 3000), 'swapped usd prices are rejected');
let unmarked = false;
try {
  markLp(lp, { at: '2026-01-02T00:00:00.000Z', sqrtPriceX96: sqrtPrice, price0Usd: 3000, price1Usd: 0 });
} catch {
  unmarked = true;
}
check(unmarked, 'a mark without token prices is refused');

const wide = openLp({
  ...lp,
  pool: '0xwide',
  feePips: 3000,
  tickLower: -887220,
  tickUpper: 887220,
  budgetToken1: 2_000_000_000_000_000_000n,
  sqrtPriceX96: sqrtPriceAtTick(0),
  price0Usd: 1,
  price1Usd: 1,
  decimals0: 18,
  decimals1: 18,
  token0: WETH.address,
  token1: USDC.address,
});
const moved = markLp(wide, {
  at: '2026-01-02T00:00:00.000Z',
  priceToken1Per0: 4,
  price0Usd: 4,
  price1Usd: 1,
});
const hodl = wide.entryEquityUsd * 2.5;
const loss = moved.impermanentLossUsd ?? 0;
near(loss / hodl, -0.2, 0.03, 'full-range il');

const owed = feesOwed(1_000_000n, 1n << 128n, 0n);
check(dilute(owed, 1_000_000n, 1_000_000n) === 500_000n, 'dilution');

const position = createLp({
  pool: lp.pool,
  token0: lp.token0,
  token1: lp.token1,
  decimals0: 18,
  decimals1: 6,
  feePips: 3000,
  tickLower: lp.tickLower,
  tickUpper: lp.tickUpper,
  budgetToken1: 1_000_000_000n,
  sqrtPriceX96: sqrtPrice,
  poolLiquidity: lp.poolLiquidity,
  price0Usd: 3000,
  price1Usd: 1,
  at: '2026-01-01T00:00:00.000Z',
});
const closed = closePosition(position, {
  kind: 2,
  lp: { at: '2026-02-01T00:00:00.000Z', sqrtPriceX96: sqrtPrice, price0Usd: 3000, price1Usd: 1, realize: true },
});
check(closed.status === 'closed' && closed.close?.at === '2026-02-01T00:00:00.000Z', 'close writes the final mark');
check(closed.basis != null && closed.basis.pnl === closed.basis.capitalOut - closed.basis.principal, 'close fixes the pulse basis');
const basisRow = toRow(closed);
check(fromRow(basisRow).basis?.pnl === closed.basis?.pnl, 'pulse basis roundtrip');
let refused = false;
try {
  closePosition(closed, { kind: 2, lp: { at: '2026-03-01T00:00:00.000Z', sqrtPriceX96: sqrtPrice, price0Usd: 1, price1Usd: 1 } });
} catch {
  refused = true;
}
check(refused, 'closed position stays closed');
const restored = fromRow(toRow(position));
check((restored.snapshot as { liquidity: bigint }).liquidity === lp.liquidity, 'snapshot roundtrip');

console.log('engine ok');

function reserve(asset: Asset, priceUsd: number, ltvBps: number, liquidationThresholdBps: number): Reserve {
  return {
    asset,
    priceUsd,
    ltvBps,
    liquidationThresholdBps,
    liquidationBonusBps: 10_500,
    collateralEnabled: true,
    borrowingEnabled: true,
    liquidityIndex: RAY,
    variableBorrowIndex: RAY,
    liquidityRate: 0n,
    variableBorrowRate: 0n,
  };
}

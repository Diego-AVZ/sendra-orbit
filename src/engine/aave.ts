import { sortCandles, type Candle } from './candles';
import type { Mark } from './lp';
import { amountUsd, borrowIndexAfter, liquidityIndexAfter, maxDrawdown, money, price8, RAY, swapRaw } from './units';

export const MAX_LOOPS = 4;
export const MAX_BORROW_BPS = 7_500;

export type Asset = {
  symbol: string;
  address: string;
  decimals: number;
};

export type Reserve = {
  asset: Asset;
  priceUsd: number;
  ltvBps: number;
  liquidationThresholdBps: number;
  liquidationBonusBps: number;
  collateralEnabled: boolean;
  borrowingEnabled: boolean;
  liquidityIndex: bigint;
  variableBorrowIndex: bigint;
  liquidityRate: bigint;
  variableBorrowRate: bigint;
};

type Leg = {
  asset: string;
  symbol: string;
  decimals: number;
  amount: bigint;
  scaled: bigint;
  index: bigint;
  rate: bigint;
  openPriceUsd: number;
  ltvBps: number;
  liquidationThresholdBps: number;
  liquidationBonusBps: number;
  collateralEnabled: boolean;
};

export type AaveSnapshot = {
  kind: 5 | 6 | 7 | 8 | 9;
  asset: string;
  symbol: string;
  principalUsdc: bigint;
  principalUsd: number;
  collateral: Leg[];
  debt: Leg[];
  proceedsUsdc: bigint;
  swapFeeBps: number;
  gasUsd: number;
  entryEquityUsd: number;
  openedAt: string;
};

export type AaveOpenInput = {
  kind: 5 | 6 | 7 | 8 | 9;
  principalUsdc: bigint;
  asset: Asset;
  reserves: Reserve[];
  loops?: number;
  borrowBps?: number;
  collateralIsAsset?: boolean;
  basket?: { asset: Asset; borrowBps: number }[];
  swapFeeBps?: number;
  gasUsd?: number;
  openedAt?: string;
};

export type AaveQuote = {
  at: string;
  seconds: number;
  prices?: Record<string, number>;
  indexes?: Record<string, { liquidityIndex: bigint; variableBorrowIndex: bigint }>;
  candles?: Candle[];
  candleSeconds?: number;
  gasUsd?: number;
  realize?: boolean;
};

const USDC_ADDRESS = '0xaf88d065e77c8cc2239327c5edb3a432268e5831';

export function sized(availableBase: bigint, oraclePrice8: bigint, decimals: number, bps: number): bigint {
  if (oraclePrice8 === 0n || availableBase === 0n || bps === 0) return 0n;
  return ((availableBase * 10n ** BigInt(decimals)) / oraclePrice8) * BigInt(bps) / 10_000n;
}

export function openAave(input: AaveOpenInput): AaveSnapshot {
  if (input.principalUsdc <= 0n) throw new Error('principal');
  const fee = input.swapFeeBps ?? 30;
  const usdc = reserveFor(input.reserves, USDC_ADDRESS);
  const asset = input.asset.address.toLowerCase() === USDC_ADDRESS ? usdc : reserveFor(input.reserves, input.asset.address);
  let collateral: Leg[] = [];
  let debt: Leg[] = [];
  let proceeds = 0n;

  if (input.kind === 5) {
    const supplied = asset.asset.address.toLowerCase() === USDC_ADDRESS
      ? input.principalUsdc
      : swapRaw(input.principalUsdc, usdc.asset, asset.asset, fee);
    collateral = [legFrom(asset, supplied)];
  } else if (input.kind === 6) {
    requireLoops(input.loops, input.borrowBps);
    if (asset.asset.address.toLowerCase() === USDC_ADDRESS) throw new Error('loop asset must not be USDC');
    let held = swapRaw(input.principalUsdc, usdc.asset, asset.asset, fee);
    collateral = [legFrom(asset, held)];
    let borrowed = 0n;
    for (let i = 0; i < (input.loops ?? 0); i += 1) {
      const tranche = borrowable(collateral, debt, usdc, input.borrowBps ?? 0);
      if (tranche === 0n) break;
      borrowed += tranche;
      held += swapRaw(tranche, usdc.asset, asset.asset, fee);
      collateral = [legFrom(asset, held)];
      debt = [debtFrom(usdc, borrowed)];
    }
    if (borrowed === 0n) throw new Error('nothing borrowed');
  } else if (input.kind === 7) {
    requireLoops(input.loops, input.borrowBps);
    if (!asset.borrowingEnabled) throw new Error('borrowing disabled');
    if (asset.asset.address.toLowerCase() === USDC_ADDRESS) throw new Error('short asset must not be USDC');
    let posted = input.principalUsdc;
    collateral = [legFrom(usdc, posted)];
    let borrowed = 0n;
    const loops = input.loops ?? 0;
    for (let i = 0; i < loops; i += 1) {
      const tranche = borrowable(collateral, debt, asset, input.borrowBps ?? 0);
      if (tranche === 0n) break;
      borrowed += tranche;
      const sold = swapRaw(tranche, asset.asset, usdc.asset, fee);
      if (i + 1 === loops) proceeds = sold;
      else {
        posted += sold;
        collateral = [legFrom(usdc, posted)];
      }
      debt = [debtFrom(asset, borrowed)];
    }
    if (borrowed === 0n) throw new Error('nothing borrowed');
  } else if (input.kind === 8) {
    requireBps(input.borrowBps);
    const postedReserve = input.collateralIsAsset ? asset : usdc;
    if (input.collateralIsAsset && postedReserve.asset.address.toLowerCase() === USDC_ADDRESS) {
      throw new Error('collateral asset must not be USDC');
    }
    const posted = input.collateralIsAsset
      ? swapRaw(input.principalUsdc, usdc.asset, asset.asset, fee)
      : input.principalUsdc;
    collateral = [legFrom(postedReserve, posted)];
    const borrowed = borrowable(collateral, debt, usdc, input.borrowBps ?? 0);
    if (borrowed === 0n) throw new Error('nothing borrowed');
    debt = [debtFrom(usdc, borrowed)];
  } else {
    const buys = input.basket ?? [];
    if (buys.length < 1 || buys.length > 3) throw new Error('basket needs 1 to 3 legs');
    if (asset.asset.address.toLowerCase() === USDC_ADDRESS) throw new Error('basket collateral must not be USDC');
    const seen = new Set<string>([USDC_ADDRESS, asset.asset.address.toLowerCase()]);
    collateral = [legFrom(asset, swapRaw(input.principalUsdc, usdc.asset, asset.asset, fee))];
    let borrowed = 0n;
    for (const buy of buys) {
      const address = buy.asset.address.toLowerCase();
      if (seen.has(address)) throw new Error('duplicate basket asset');
      seen.add(address);
      requireBps(buy.borrowBps);
      const legReserve = reserveFor(input.reserves, address);
      const tranche = borrowable(collateral, debt, usdc, buy.borrowBps);
      if (tranche === 0n) throw new Error('nothing borrowed');
      borrowed += tranche;
      collateral.push(legFrom(legReserve, swapRaw(tranche, usdc.asset, legReserve.asset, fee)));
      debt = [debtFrom(usdc, borrowed)];
    }
  }

  const snapshot: AaveSnapshot = {
    kind: input.kind,
    asset: asset.asset.address.toLowerCase(),
    symbol: asset.asset.symbol,
    principalUsdc: input.principalUsdc,
    principalUsd: amountUsd(input.principalUsdc, 6, usdc.priceUsd),
    collateral,
    debt,
    proceedsUsdc: proceeds,
    swapFeeBps: fee,
    gasUsd: input.gasUsd ?? 0,
    entryEquityUsd: 0,
    openedAt: input.openedAt ?? new Date(0).toISOString(),
  };
  snapshot.entryEquityUsd = markAave(snapshot, { at: snapshot.openedAt, seconds: 0, prices: openPrices(input.reserves) }).equityUsd;
  return snapshot;
}

export function markAave(snapshot: AaveSnapshot, quote: AaveQuote): Mark {
  const prices = new Map<string, number>();
  for (const leg of [...snapshot.collateral, ...snapshot.debt]) prices.set(leg.asset, leg.openPriceUsd);
  for (const [address, price] of Object.entries(quote.prices ?? {})) prices.set(address.toLowerCase(), price);
  const candles = quote.candles ? sortCandles(quote.candles) : [];
  if (candles.length) prices.set(snapshot.asset, candles[candles.length - 1].close);

  const valued = valueBook(snapshot, prices, quote);
  const exit = quote.realize ? exitCost(snapshot, valued, prices) : 0;
  const equity = valued.liquidated ? valued.liquidatedEquity : valued.equity;
  const path = candles.map((candle) => {
    const stepped = new Map(prices);
    stepped.set(snapshot.asset, candle.close);
    const seconds = Math.max(0, candle.time - Date.parse(snapshot.openedAt) / 1000);
    return valueBook(snapshot, stepped, { ...quote, seconds, indexes: undefined }).equity;
  });
  const equityAfter = equity - exit;
  return {
    at: quote.at,
    equityUsd: money(equityAfter),
    pnlUsd: money(equityAfter - snapshot.principalUsd - snapshot.gasUsd - (quote.gasUsd ?? 0)),
    feesUsd: 0,
    interestUsd: money(valued.interestUsd),
    impermanentLossUsd: null,
    inRange: null,
    timeInRangeSeconds: null,
    healthFactor: valued.healthFactor == null ? null : money(valued.healthFactor),
    liquidated: valued.liquidated,
    liquidationPriceUsd: liquidationPrice(snapshot),
    maxDrawdownUsd: maxDrawdown([snapshot.entryEquityUsd, ...path, equityAfter]),
    price: prices.get(snapshot.asset) ?? null,
  };
}

export function liquidationPrice(snapshot: AaveSnapshot): number | null {
  const collateral = snapshot.collateral.filter((leg) => leg.collateralEnabled);
  if (collateral.length !== 1 || snapshot.debt.length !== 1) return null;
  const posted = collateral[0];
  const owed = snapshot.debt[0];
  const debtIsQuoted = snapshot.kind === 7;
  const usdc = debtIsQuoted ? posted : owed;
  if (usdc.symbol !== 'USDC' && usdc.asset !== USDC_ADDRESS) return null;
  return aaveLiquidationPrice(
    debtIsQuoted,
    posted.amount,
    owed.amount,
    posted.decimals,
    owed.decimals,
    posted.liquidationThresholdBps,
    price8(usdc.openPriceUsd),
  );
}

export function aaveLiquidationPrice(
  debtIsQuoted: boolean,
  collateralAmount: bigint,
  debtAmount: bigint,
  collateralDecimals: number,
  debtDecimals: number,
  thresholdBps: number,
  usdcPrice8: bigint,
): number | null {
  if (collateralAmount === 0n || debtAmount === 0n || thresholdBps === 0 || usdcPrice8 === 0n) return null;
  const threshold = BigInt(thresholdBps);
  if (debtIsQuoted) {
    const collateralBase = (collateralAmount * usdcPrice8) / 10n ** BigInt(collateralDecimals);
    return Number((collateralBase * threshold * 10n ** BigInt(debtDecimals)) / (10_000n * debtAmount)) / 1e8;
  }
  const debtBase = (debtAmount * usdcPrice8) / 10n ** BigInt(debtDecimals);
  return Number((debtBase * 10_000n * 10n ** BigInt(collateralDecimals)) / (collateralAmount * threshold)) / 1e8;
}

function valueBook(snapshot: AaveSnapshot, prices: Map<string, number>, quote: AaveQuote) {
  let suppliedUsd = 0;
  let collateralUsd = 0;
  let weightedThreshold = 0;
  let weightedLtv = 0;
  let bonusWeighted = 0;
  let interestUsd = 0;
  for (const leg of snapshot.collateral) {
    const accrued = accruedAmount(leg, quote, 'supply');
    const price = prices.get(leg.asset) ?? leg.openPriceUsd;
    const usd = amountUsd(accrued, leg.decimals, price);
    suppliedUsd += usd;
    interestUsd += amountUsd(accrued - leg.amount, leg.decimals, leg.openPriceUsd);
    if (!leg.collateralEnabled) continue;
    collateralUsd += usd;
    weightedThreshold += usd * leg.liquidationThresholdBps;
    weightedLtv += usd * leg.ltvBps;
    bonusWeighted += usd * leg.liquidationBonusBps;
  }
  let debtUsd = 0;
  for (const leg of snapshot.debt) {
    const accrued = accruedAmount(leg, quote, 'borrow');
    const price = prices.get(leg.asset) ?? leg.openPriceUsd;
    debtUsd += amountUsd(accrued, leg.decimals, price);
    interestUsd -= amountUsd(accrued - leg.amount, leg.decimals, leg.openPriceUsd);
  }
  const proceedsUsd = amountUsd(snapshot.proceedsUsdc, 6, prices.get(USDC_ADDRESS) ?? 1);
  const threshold = collateralUsd > 0 ? weightedThreshold / collateralUsd : 0;
  const liquidated = debtUsd > 0 && collateralUsd * threshold < debtUsd * 10_000;
  const healthFactor = debtUsd === 0 ? null : (collateralUsd * threshold) / (debtUsd * 10_000);
  const bonus = collateralUsd > 0 ? bonusWeighted / collateralUsd : 10_000;
  const seized = (debtUsd * bonus) / 10_000;
  const liquidatedEquity = Math.max(0, collateralUsd - seized) + (suppliedUsd - collateralUsd) + proceedsUsd;
  return {
    equity: suppliedUsd + proceedsUsd - debtUsd,
    liquidatedEquity,
    liquidated,
    healthFactor,
    interestUsd,
    collateralUsd,
    debtUsd,
    suppliedUsd,
    proceedsUsd,
    availableBase: baseFromUsd(Math.max(0, (collateralUsd * (collateralUsd > 0 ? weightedLtv / collateralUsd : 0)) / 10_000 - debtUsd)),
  };
}

function exitCost(snapshot: AaveSnapshot, valued: { suppliedUsd: number; debtUsd: number }, prices: Map<string, number>): number {
  const fee = snapshot.swapFeeBps / 10_000;
  let cost = 0;
  for (const leg of snapshot.collateral) {
    if (leg.asset === USDC_ADDRESS) continue;
    const price = prices.get(leg.asset) ?? leg.openPriceUsd;
    cost += amountUsd(leg.amount, leg.decimals, price) * fee;
  }
  for (const leg of snapshot.debt) {
    if (leg.asset === USDC_ADDRESS) continue;
    const price = prices.get(leg.asset) ?? leg.openPriceUsd;
    cost += amountUsd(leg.amount, leg.decimals, price) * fee;
  }
  if (snapshot.kind === 8) return cost;
  return Math.min(cost, valued.suppliedUsd + valued.debtUsd);
}

function accruedAmount(leg: Leg, quote: AaveQuote, kind: 'supply' | 'borrow'): bigint {
  const live = quote.indexes?.[leg.asset];
  const index = live
    ? kind === 'supply' ? live.liquidityIndex : live.variableBorrowIndex
    : kind === 'supply'
      ? liquidityIndexAfter(leg.index, leg.rate, quote.seconds)
      : borrowIndexAfter(leg.index, leg.rate, quote.seconds);
  if (index <= 0n) return leg.amount;
  return (leg.scaled * index) / RAY;
}

function borrowable(collateral: Leg[], debt: Leg[], reserve: Reserve, bps: number): bigint {
  const prices = openPricesFromLegs(collateral, debt);
  const book = valueBook(
    { collateral, debt, proceedsUsdc: 0n, kind: 5, asset: reserve.asset.address, symbol: '', principalUsdc: 0n, principalUsd: 0, swapFeeBps: 0, gasUsd: 0, entryEquityUsd: 0, openedAt: '' },
    prices,
    { at: '', seconds: 0 },
  );
  return sized(book.availableBase, price8(reserve.priceUsd), reserve.asset.decimals, bps);
}

function baseFromUsd(usd: number): bigint {
  if (usd <= 0) return 0n;
  return BigInt(Math.round(usd * 1e8));
}

function openPrices(reserves: Reserve[]): Record<string, number> {
  return Object.fromEntries(reserves.map((reserve) => [reserve.asset.address.toLowerCase(), reserve.priceUsd]));
}

function openPricesFromLegs(collateral: Leg[], debt: Leg[]): Map<string, number> {
  const prices = new Map<string, number>();
  for (const leg of [...collateral, ...debt]) prices.set(leg.asset, leg.openPriceUsd);
  return prices;
}

function legFrom(reserve: Reserve, amount: bigint): Leg {
  if (reserve.liquidityIndex <= 0n) throw new Error('liquidity index');
  return {
    asset: reserve.asset.address.toLowerCase(),
    symbol: reserve.asset.symbol,
    decimals: reserve.asset.decimals,
    amount,
    scaled: (amount * RAY) / reserve.liquidityIndex,
    index: reserve.liquidityIndex,
    rate: reserve.liquidityRate,
    openPriceUsd: reserve.priceUsd,
    ltvBps: reserve.ltvBps,
    liquidationThresholdBps: reserve.liquidationThresholdBps,
    liquidationBonusBps: reserve.liquidationBonusBps,
    collateralEnabled: reserve.collateralEnabled && reserve.ltvBps > 0,
  };
}

function debtFrom(reserve: Reserve, amount: bigint): Leg {
  if (!reserve.borrowingEnabled) throw new Error('borrowing disabled');
  if (reserve.variableBorrowIndex <= 0n) throw new Error('borrow index');
  return {
    asset: reserve.asset.address.toLowerCase(),
    symbol: reserve.asset.symbol,
    decimals: reserve.asset.decimals,
    amount,
    scaled: (amount * RAY) / reserve.variableBorrowIndex,
    index: reserve.variableBorrowIndex,
    rate: reserve.variableBorrowRate,
    openPriceUsd: reserve.priceUsd,
    ltvBps: 0,
    liquidationThresholdBps: 0,
    liquidationBonusBps: 0,
    collateralEnabled: false,
  };
}

function reserveFor(reserves: Reserve[], address: string): Reserve {
  const found = reserves.find((reserve) => reserve.asset.address.toLowerCase() === address.toLowerCase());
  if (!found) throw new Error(`missing reserve ${address}`);
  return found;
}

function requireLoops(loops: number | undefined, bps: number | undefined) {
  if (loops == null || loops < 1 || loops > MAX_LOOPS) throw new Error('loops must be 1 to 4');
  requireBps(bps);
}

function requireBps(bps: number | undefined) {
  if (bps == null || bps < 1 || bps > MAX_BORROW_BPS) throw new Error('borrowBps must be 1 to 7500');
}

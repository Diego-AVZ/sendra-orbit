import { readPool, readReserve } from './chain';
import { fetchAssetCandles, fetchPoolCandles, poolPrices } from './market';
import {
  closePosition,
  createAave,
  createLeveragedLp,
  createLp,
  createSpot,
  markPosition,
  type PaperPosition,
  type PositionQuote,
} from './position';
import { saveMark, savePosition } from './store';
import type { Asset } from './assets';
import type { AaveOpenInput } from './aave';
import type { LpOpenInput } from './lp';
import type { SpotOpenInput } from './spot';

export type LiveResult = { position: PaperPosition; warnings: string[] };

type Persist = { persist?: boolean; accessToken?: string; rpc?: string };

export async function openLpLive(input: Omit<LpOpenInput, 'sqrtPriceX96' | 'poolLiquidity' | 'feeGrowth0' | 'feeGrowth1' | 'price0Usd' | 'price1Usd'> & Partial<Pick<LpOpenInput, 'price0Usd' | 'price1Usd'>> & Persist & { userId?: string | null; evaluationId?: string | null }): Promise<LiveResult> {
  const pool = await readPool(input.pool, input.tickLower, input.tickUpper, input.rpc);
  const prices = input.price0Usd != null && input.price1Usd != null
    ? { price0Usd: input.price0Usd, price1Usd: input.price1Usd }
    : await poolPrices(input.pool, input.token0, input.token1);
  const position = createLp({
    ...input,
    ...prices,
    sqrtPriceX96: pool.sqrtPriceX96,
    poolLiquidity: pool.liquidity,
    feeGrowth0: pool.feeGrowthInside0,
    feeGrowth1: pool.feeGrowthInside1,
  });
  return finish(position, [], input);
}

export async function openAaveLive(input: AaveOpenInput & Persist & { userId?: string | null; evaluationId?: string | null }): Promise<LiveResult> {
  const reserves = await Promise.all(input.reserves.map((reserve) => readReserve(reserve.asset, input.rpc)));
  const position = createAave({ ...input, reserves });
  return finish(position, [], input);
}

export async function openLeveragedLive(
  input: AaveOpenInput & Omit<LpOpenInput, 'budgetToken1' | 'sqrtPriceX96' | 'poolLiquidity' | 'feeGrowth0' | 'feeGrowth1' | 'price0Usd' | 'price1Usd'> & Partial<Pick<LpOpenInput, 'price0Usd' | 'price1Usd'>> & Persist & { userId?: string | null; evaluationId?: string | null },
): Promise<LiveResult> {
  const reserves = await Promise.all(input.reserves.map((reserve) => readReserve(reserve.asset, input.rpc)));
  const pool = await readPool(input.pool, input.tickLower, input.tickUpper, input.rpc);
  const prices = input.price0Usd != null && input.price1Usd != null
    ? { price0Usd: input.price0Usd, price1Usd: input.price1Usd }
    : await poolPrices(input.pool, input.token0, input.token1);
  const position = createLeveragedLp({
    ...input,
    ...prices,
    reserves,
    sqrtPriceX96: pool.sqrtPriceX96,
    poolLiquidity: pool.liquidity,
    feeGrowth0: pool.feeGrowthInside0,
    feeGrowth1: pool.feeGrowthInside1,
  });
  return finish(position, [], input);
}

export async function openSpotLive(input: SpotOpenInput & Persist & { userId?: string | null; evaluationId?: string | null }): Promise<LiveResult> {
  const reserve = await readReserve(input.asset, input.rpc);
  const position = createSpot({ ...input, priceUsd: input.priceUsd || reserve.priceUsd });
  return finish(position, [], input);
}

export async function refreshLive(position: PaperPosition, options: Persist = {}): Promise<LiveResult> {
  const warnings: string[] = [];
  const quote = await quoteLive(position, options.rpc, warnings);
  const marked = markPosition(position, quote);
  return finish(marked, warnings, options);
}

export async function closeLive(position: PaperPosition, options: Persist = {}): Promise<LiveResult> {
  const warnings: string[] = [];
  const quote = await quoteLive(position, options.rpc, warnings);
  const closed = closePosition(position, quote);
  return finish(closed, warnings, options);
}

async function finish(position: PaperPosition, warnings: string[], options: Persist): Promise<LiveResult> {
  if (!options.persist) return { position, warnings };
  const saved = position.status === 'open' && position.mark?.at === position.openedAt
    ? await savePosition(position, options.accessToken)
    : await saveMark(position, options.accessToken);
  return { position: saved, warnings };
}

async function quoteLive(position: PaperPosition, rpc: string | undefined, warnings: string[]): Promise<PositionQuote> {
  const since = Math.floor(Date.parse(position.openedAt) / 1000);
  if (position.kind === 2 || position.kind === 8) {
    const lp = position.kind === 2 ? position.snapshot as { pool: string; token0: string; token1: string; tickLower: number; tickUpper: number } : (position.snapshot as { lp: { pool: string; token0: string; token1: string; tickLower: number; tickUpper: number } }).lp;
    const pool = await readPool(lp.pool, lp.tickLower, lp.tickUpper, rpc);
    const stored = lp as { price0Usd?: number; price1Usd?: number };
    let candles;
    let prices = { price0Usd: stored.price0Usd ?? 0, price1Usd: stored.price1Usd ?? 0 };
    try {
      const [nextCandles, nextPrices] = await Promise.all([
        fetchPoolCandles(lp.pool, lp.token0, lp.token1, since),
        poolPrices(lp.pool, lp.token0, lp.token1),
      ]);
      candles = nextCandles;
      prices = nextPrices;
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : 'candles unavailable');
    }
    const lpQuote = {
      at: new Date().toISOString(),
      sqrtPriceX96: pool.sqrtPriceX96,
      price0Usd: prices.price0Usd,
      price1Usd: prices.price1Usd,
      poolLiquidity: pool.liquidity,
      feeGrowth0: pool.feeGrowthInside0,
      feeGrowth1: pool.feeGrowthInside1,
      candles,
      candleSeconds: 3600,
    };
    if (position.kind === 2) return { kind: 2, lp: lpQuote };
    const aave = await aaveQuote(position, rpc, since, warnings);
    return { kind: 8, aave: { ...aave, at: lpQuote.at }, lp: lpQuote };
  }
  if (position.kind === 4) {
    const snapshot = position.snapshot as { symbol: string };
    let candles;
    try {
      candles = await fetchAssetCandles(snapshot.symbol, since);
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : 'candles unavailable');
    }
    const asset = { symbol: snapshot.symbol, address: (position.snapshot as { asset: string }).asset, decimals: (position.snapshot as { decimals: number }).decimals };
    const reserve = await readReserve(asset, rpc);
    return { kind: 4, spot: { at: new Date().toISOString(), priceUsd: reserve.priceUsd, candles } };
  }
  return { kind: position.kind, aave: await aaveQuote(position, rpc, since, warnings) };
}

async function aaveQuote(position: PaperPosition, rpc: string | undefined, since: number, warnings: string[]) {
  const snapshot = position.kind === 8
    ? (position.snapshot as { aave: { collateral: AssetLeg[]; debt: AssetLeg[]; symbol: string } }).aave
    : position.snapshot as { collateral: AssetLeg[]; debt: AssetLeg[]; symbol: string };
  const legs = [...snapshot.collateral, ...snapshot.debt];
  const unique = new Map(legs.map((leg) => [leg.asset, leg]));
  const reserves = await Promise.all([...unique.values()].map((leg) => readReserve(asAsset(leg), rpc)));
  let candles;
  try {
    candles = await fetchAssetCandles(snapshot.symbol, since);
  } catch (error) {
    warnings.push(error instanceof Error ? error.message : 'candles unavailable');
  }
  return {
    at: new Date().toISOString(),
    seconds: Math.max(0, Math.floor(Date.now() / 1000) - since),
    prices: Object.fromEntries(reserves.map((reserve) => [reserve.asset.address.toLowerCase(), reserve.priceUsd])),
    indexes: Object.fromEntries(reserves.map((reserve) => [reserve.asset.address.toLowerCase(), {
      liquidityIndex: reserve.liquidityIndex,
      variableBorrowIndex: reserve.variableBorrowIndex,
    }])),
    candles,
    candleSeconds: 3600,
  };
}

type AssetLeg = { asset: string; symbol: string; decimals: number };

function asAsset(leg: AssetLeg): Asset {
  return { symbol: leg.symbol, address: leg.asset, decimals: leg.decimals };
}

import { openAave, markAave, type AaveOpenInput, type AaveQuote, type AaveSnapshot } from './aave';
import { markLp, openLp, type LpOpenInput, type LpQuote, type LpSnapshot, type Mark } from './lp';
import { markSpot, openSpot, type SpotOpenInput, type SpotQuote, type SpotSnapshot } from './spot';
import { USDC } from './assets';
import { money, swapRaw, usdcRaw } from './units';

export type Kind = 2 | 4 | 5 | 6 | 7 | 8 | 9;

export type Snapshot = LpSnapshot | AaveSnapshot | SpotSnapshot | { aave: AaveSnapshot; lp: LpSnapshot };

export type PaperPosition = {
  id: string;
  userId: string | null;
  evaluationId: string | null;
  kind: Kind;
  status: 'open' | 'closed';
  openedAt: string;
  closedAt: string | null;
  params: Record<string, unknown>;
  snapshot: Snapshot;
  mark: Mark | null;
  close: Mark | null;
  /** USDC of 6 decimals, fixed at close. pnl = capitalOut - principal, gas excluded. */
  basis: PulseBasis | null;
};

export type PulseBasis = {
  principal: bigint;
  capitalOut: bigint;
  pnl: bigint;
};

type Owner = { userId?: string | null; evaluationId?: string | null; at?: string };

export function createLp(input: LpOpenInput & Owner): PaperPosition {
  const snapshot = openLp(input);
  const at = input.at ?? new Date().toISOString();
  const mark = markLp(snapshot, {
    at,
    sqrtPriceX96: input.sqrtPriceX96,
    price0Usd: input.price0Usd,
    price1Usd: input.price1Usd,
    poolLiquidity: input.poolLiquidity,
    feeGrowth0: input.feeGrowth0,
    feeGrowth1: input.feeGrowth1,
  });
  return row(2, at, input, snapshot, mark, {
    protocol: 'uniswap-v3',
    pool: snapshot.pool,
    token0: snapshot.token0,
    token1: snapshot.token1,
    feePips: snapshot.feePips,
    tickLower: snapshot.tickLower,
    tickUpper: snapshot.tickUpper,
    budgetToken1: input.budgetToken1.toString(),
  });
}

export function createAave(input: AaveOpenInput & Owner): PaperPosition {
  if (input.kind === 8) throw new Error('use createLeveragedLp');
  const at = input.at ?? input.openedAt ?? new Date().toISOString();
  const snapshot = openAave({ ...input, openedAt: at });
  const mark = markAave(snapshot, { at, seconds: 0, prices: pricesOf(input) });
  return row(input.kind, at, input, snapshot, mark, {
    protocol: 'aave-v3',
    kind: input.kind,
    asset: snapshot.asset,
    symbol: snapshot.symbol,
    principalUsdc: input.principalUsdc.toString(),
    loops: input.loops ?? null,
    borrowBps: input.borrowBps ?? null,
    basket: input.basket?.map((leg) => ({ asset: leg.asset.address.toLowerCase(), borrowBps: leg.borrowBps })) ?? null,
  });
}

export function createLeveragedLp(input: AaveOpenInput & Omit<LpOpenInput, 'budgetToken1'> & Owner): PaperPosition {
  const at = input.at ?? new Date().toISOString();
  const aave = openAave({ ...input, kind: 8, openedAt: at, gasUsd: input.gasUsd ?? 0 });
  const debt = aave.debt[0]?.amount ?? 0n;
  const token0 = input.token0.toLowerCase();
  const token1 = input.token1.toLowerCase();
  if (token0 !== USDC.address && token1 !== USDC.address) throw new Error('leveraged LP pair needs USDC');
  const budget = token1 === USDC.address
    ? debt
    : swapRaw(debt, { decimals: 6, priceUsd: 1 }, { decimals: input.decimals1, priceUsd: input.price1Usd }, input.swapFeeBps ?? 0);
  const lp = openLp({ ...input, budgetToken1: budget, gasUsd: 0 });
  const mark = markLeveraged({ aave, lp }, { at, seconds: 0, prices: pricesOf(input) }, {
    at,
    sqrtPriceX96: input.sqrtPriceX96,
    price0Usd: input.price0Usd,
    price1Usd: input.price1Usd,
    poolLiquidity: input.poolLiquidity,
    feeGrowth0: input.feeGrowth0,
    feeGrowth1: input.feeGrowth1,
  });
  return row(8, at, input, { aave, lp }, mark, {
    protocol: 'aave-v3+uniswap-v3',
    asset: aave.asset,
    principalUsdc: input.principalUsdc.toString(),
    borrowBps: input.borrowBps ?? null,
    pool: lp.pool,
    feePips: lp.feePips,
    tickLower: lp.tickLower,
    tickUpper: lp.tickUpper,
  });
}

export function createSpot(input: SpotOpenInput & Owner): PaperPosition {
  const snapshot = openSpot(input);
  const at = input.at ?? new Date().toISOString();
  const mark = markSpot(snapshot, { at, priceUsd: input.priceUsd });
  return row(4, at, input, snapshot, mark, {
    protocol: 'spot',
    asset: snapshot.asset,
    symbol: snapshot.symbol,
    principalUsdc: input.principalUsdc.toString(),
    priceUsd: input.priceUsd,
    feeBps: snapshot.feeBps,
  });
}

export function markPosition(position: PaperPosition, quote: PositionQuote): PaperPosition {
  if (position.status === 'closed') throw new Error('position is closed');
  return { ...position, mark: quotePosition(position, quote, false) };
}

export function closePosition(position: PaperPosition, quote: PositionQuote): PaperPosition {
  if (position.status === 'closed') throw new Error('position is closed');
  const mark = quotePosition(position, quote, true);
  return { ...position, status: 'closed', closedAt: mark.at, mark, close: mark, basis: pulseBasis(position, mark, quote) };
}

export type PositionQuote =
  | { kind: 2; lp: LpQuote }
  | { kind: 4; spot: SpotQuote }
  | { kind: 5 | 6 | 7 | 9; aave: AaveQuote }
  | { kind: 8; aave: AaveQuote; lp: LpQuote };

function quotePosition(position: PaperPosition, quote: PositionQuote, realize: boolean): Mark {
  if (quote.kind !== position.kind) throw new Error('quote does not match the position');
  if (quote.kind === 2) return markLp(position.snapshot as LpSnapshot, { ...quote.lp, realize });
  if (quote.kind === 4) return markSpot(position.snapshot as SpotSnapshot, quote.spot);
  if (quote.kind === 8) {
    const snapshot = position.snapshot as { aave: AaveSnapshot; lp: LpSnapshot };
    return markLeveraged(snapshot, { ...quote.aave, realize }, { ...quote.lp, realize });
  }
  return markAave(position.snapshot as AaveSnapshot, { ...quote.aave, realize });
}

function markLeveraged(snapshot: { aave: AaveSnapshot; lp: LpSnapshot }, aave: AaveQuote, lp: LpQuote): Mark {
  const book = markAave(snapshot.aave, aave);
  const range = markLp(snapshot.lp, lp);
  const equity = book.equityUsd + range.equityUsd;
  return {
    at: aave.at,
    equityUsd: money(equity),
    pnlUsd: money(equity - snapshot.aave.principalUsd - snapshot.aave.gasUsd - snapshot.lp.gasUsd - (aave.gasUsd ?? 0) - (lp.gasUsd ?? 0)),
    feesUsd: range.feesUsd,
    interestUsd: book.interestUsd,
    impermanentLossUsd: range.impermanentLossUsd,
    inRange: range.inRange,
    timeInRangeSeconds: range.timeInRangeSeconds,
    healthFactor: book.healthFactor,
    liquidated: book.liquidated,
    liquidationPriceUsd: book.liquidationPriceUsd,
    maxDrawdownUsd: money(Math.max(book.maxDrawdownUsd, range.maxDrawdownUsd)),
    price: range.price,
  };
}

function pricesOf(input: AaveOpenInput): Record<string, number> {
  return Object.fromEntries(input.reserves.map((reserve) => [reserve.asset.address.toLowerCase(), reserve.priceUsd]));
}

function row(
  kind: Kind,
  at: string,
  owner: Owner,
  snapshot: Snapshot,
  mark: Mark,
  params: Record<string, unknown>,
): PaperPosition {
  return {
    id: crypto.randomUUID(),
    userId: owner.userId ?? null,
    evaluationId: owner.evaluationId ?? null,
    kind,
    status: 'open',
    openedAt: at,
    closedAt: null,
    params,
    snapshot,
    mark,
    close: null,
    basis: null,
  };
}

function pulseBasis(position: PaperPosition, mark: Mark, quote: PositionQuote): PulseBasis {
  const principal = principalRaw(position);
  const capitalOut = quote.kind === 4
    ? swapRaw(
      (position.snapshot as SpotSnapshot).tokens,
      { decimals: (position.snapshot as SpotSnapshot).decimals, priceUsd: quote.spot.priceUsd },
      { decimals: 6, priceUsd: 1 },
      (position.snapshot as SpotSnapshot).feeBps,
    )
    : usdcRaw(mark.equityUsd);
  return { principal, capitalOut, pnl: capitalOut - principal };
}

function principalRaw(position: PaperPosition): bigint {
  if (position.kind === 2) return usdcRaw((position.snapshot as LpSnapshot).principalUsd);
  if (position.kind === 8) return (position.snapshot as { aave: AaveSnapshot }).aave.principalUsdc;
  if (position.kind === 4) return (position.snapshot as SpotSnapshot).principalUsdc;
  return (position.snapshot as AaveSnapshot).principalUsdc;
}

export function pack(value: unknown): unknown {
  if (typeof value === 'bigint') return { $: value.toString() };
  if (Array.isArray(value)) return value.map(pack);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) out[key] = pack(item);
    return out;
  }
  return value;
}

export function unpack(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(unpack);
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.$ === 'string' && Object.keys(record).length === 1) return BigInt(record.$);
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(record)) out[key] = unpack(item);
    return out;
  }
  return value;
}

export type PositionRow = {
  id: string;
  user_id: string | null;
  evaluation_id: string | null;
  kind: number;
  status: 'open' | 'closed';
  opened_at: string;
  closed_at: string | null;
  params: Record<string, unknown>;
  open_snapshot: unknown;
  mark: Mark | null;
  close: Mark | null;
  pnl_usd: number | null;
  principal_raw: string | null;
  capital_out_raw: string | null;
  pnl_raw: string | null;
};

export function toRow(position: PaperPosition): PositionRow {
  return {
    id: position.id,
    user_id: position.userId,
    evaluation_id: position.evaluationId,
    kind: position.kind,
    status: position.status,
    opened_at: position.openedAt,
    closed_at: position.closedAt,
    params: position.params,
    open_snapshot: pack(position.snapshot),
    mark: position.mark,
    close: position.close,
    pnl_usd: position.close?.pnlUsd ?? position.mark?.pnlUsd ?? null,
    principal_raw: position.basis ? position.basis.principal.toString() : null,
    capital_out_raw: position.basis ? position.basis.capitalOut.toString() : null,
    pnl_raw: position.basis ? position.basis.pnl.toString() : null,
  };
}

export function fromRow(row: PositionRow): PaperPosition {
  return {
    id: row.id,
    userId: row.user_id,
    evaluationId: row.evaluation_id,
    kind: row.kind as Kind,
    status: row.status,
    openedAt: row.opened_at,
    closedAt: row.closed_at,
    params: row.params,
    snapshot: unpack(row.open_snapshot) as Snapshot,
    mark: row.mark,
    close: row.close,
    basis: row.principal_raw == null || row.capital_out_raw == null || row.pnl_raw == null
      ? null
      : {
        principal: BigInt(row.principal_raw),
        capitalOut: BigInt(row.capital_out_raw),
        pnl: BigInt(row.pnl_raw),
      },
  };
}

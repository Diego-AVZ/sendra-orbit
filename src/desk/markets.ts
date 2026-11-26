import type { Reserve } from '@/engine/aave';
import { AAVE, LINK, UNI, USDC, USDT, WBTC, WETH, type Asset } from '@/engine/assets';
import { tickAtHuman } from '@/engine/tick';

export const SPOT = [
  { coin: 'BTC', asset: WBTC },
  { coin: 'ETH', asset: WETH },
  { coin: 'LINK', asset: LINK },
  { coin: 'AAVE', asset: AAVE },
  { coin: 'UNI', asset: UNI },
] as const;

export type Pool = {
  id: string;
  label: string;
  pool: string;
  token0: Asset;
  token1: Asset;
  feePips: number;
};

/** Arbitrum v3 whitelist Sendra Labs lists. Token order is the pool's. Labs hides a pool under 25k TVL, with no volume yesterday, or under 0.05% pool APR. */
export const POOLS: Pool[] = [
  {
    id: 'eth-usdc',
    label: 'ETH / USDC',
    pool: '0xC6962004f452bE9203591991D15f6b388e09E8D0',
    token0: WETH,
    token1: USDC,
    feePips: 500,
  },
  {
    id: 'eth-usdt',
    label: 'ETH / USD₮0',
    pool: '0x641C00A822e8b671738d32a431a4Fb6074E5c79d',
    token0: WETH,
    token1: USDT,
    feePips: 500,
  },
  {
    id: 'usdc-usdt',
    label: 'USDC / USD₮0',
    pool: '0xbe3ad6a5669dc0b8b12febc03608860c31e2eef6',
    token0: USDC,
    token1: USDT,
    feePips: 100,
  },
  {
    id: 'btc-eth',
    label: 'BTC / ETH',
    pool: '0x2f5e87C9312fa29aed5c179E456625D79015299c',
    token0: WBTC,
    token1: WETH,
    feePips: 500,
  },
  {
    id: 'btc-usdt',
    label: 'BTC / USD₮0',
    pool: '0x5969EFddE3cF5C0D9a88aE51E47d721096A97203',
    token0: WBTC,
    token1: USDT,
    feePips: 500,
  },
  {
    id: 'eth-link',
    label: 'ETH / LINK',
    pool: '0x468b88941e7Cc0B88c1869d68ab6b570bCEF62Ff',
    token0: WETH,
    token1: LINK,
    feePips: 3000,
  },
  {
    id: 'link-usdt',
    label: 'LINK / USD₮0',
    pool: '0x32A5746bA6826828716Cc1A394bC33301eBc7656',
    token0: LINK,
    token1: USDT,
    feePips: 3000,
  },
  {
    id: 'eth-uni',
    label: 'ETH / UNI',
    pool: '0xc24f7d8e51a64dc1238880bd00bb961d54cbeb29',
    token0: WETH,
    token1: UNI,
    feePips: 3000,
  },
  {
    id: 'uni-usdt',
    label: 'UNI / USD₮0',
    pool: '0xd97c8ee1c1e47f50a66e69d5ad155f882e38b0e5',
    token0: UNI,
    token1: USDT,
    feePips: 3000,
  },
  {
    id: 'eth-aave',
    label: 'ETH / AAVE',
    pool: '0xdd672b3b768a16b9bcb4ee1060d3e8221435beaa',
    token0: WETH,
    token1: AAVE,
    feePips: 3000,
  },
  {
    id: 'aave-usdt',
    label: 'AAVE / USD₮0',
    pool: '0x49768b215014fac2c66680b03045fe32936b21e6',
    token0: AAVE,
    token1: USDT,
    feePips: 3000,
  },
];

export const ETH_USDC = POOLS[0];

const SPACING: Record<number, number> = { 100: 1, 500: 10, 3000: 60, 10000: 200 };

export type RangeMode = 'preset' | 'custom';
export type Strategy = 'bullish' | 'neutral' | 'bearish';
export type Risk = 'low' | 'medium' | 'high';

export function coinOf(symbol: string): string {
  if (symbol === 'WBTC') return 'BTC';
  if (symbol === 'WETH') return 'ETH';
  if (symbol === 'USDT') return 'USD₮0';
  return symbol;
}

export function spacingOf(feePips: number): number {
  return SPACING[feePips] ?? 60;
}

export function priceBand(
  price: number,
  mode: RangeMode,
  strategy: Strategy,
  risk: Risk,
  lowPct: string,
  highPct: string,
  startInside: boolean,
): { min: number; max: number } {
  if (!(price > 0)) return { min: 0, max: 0 };
  if (mode === 'custom') {
    const low = Number(lowPct);
    const high = Number(highPct);
    return {
      min: price * (1 - (Number.isFinite(low) ? low : 10) / 100),
      max: price * (1 + (Number.isFinite(high) ? high : 10) / 100),
    };
  }
  const mult = risk === 'low' ? 2 : risk === 'high' ? 1 : 1.5;
  const spread = 0.1 * mult;
  if (strategy === 'bullish') {
    return startInside
      ? { min: price * (1 - spread * 0.25), max: price * (1 + spread) }
      : { min: price * 1.001, max: price * (1 + spread) };
  }
  if (strategy === 'bearish') {
    return startInside
      ? { min: price * (1 - spread), max: price * (1 + spread * 0.25) }
      : { min: price * (1 - spread), max: price * 0.999 };
  }
  return { min: price * (1 - spread), max: price * (1 + spread) };
}

export function rangeTicks(
  low: number,
  high: number,
  decimals0: number,
  decimals1: number,
  feePips: number,
): { tickLower: number; tickUpper: number } {
  const spacing = spacingOf(feePips);
  const down = (tick: number) => Math.floor(tick / spacing) * spacing;
  const up = (tick: number) => Math.ceil(tick / spacing) * spacing;
  let tickLower = down(tickAtHuman(Math.min(low, high), decimals0, decimals1));
  let tickUpper = up(tickAtHuman(Math.max(low, high), decimals0, decimals1));
  if (tickUpper <= tickLower) tickUpper = tickLower + spacing;
  return { tickLower, tickUpper };
}

export function stubReserve(asset: Asset): Reserve {
  return {
    asset,
    priceUsd: asset.symbol === 'USDC' ? 1 : 0,
    ltvBps: 0,
    liquidationThresholdBps: 0,
    liquidationBonusBps: 0,
    collateralEnabled: true,
    borrowingEnabled: true,
    liquidityIndex: 0n,
    variableBorrowIndex: 0n,
    liquidityRate: 0n,
    variableBorrowRate: 0n,
  };
}

export function reservesFor(assets: Asset[]): Reserve[] {
  const seen = new Set<string>();
  const list: Asset[] = [];
  for (const asset of [USDC, ...assets]) {
    const id = asset.address.toLowerCase();
    if (seen.has(id)) continue;
    seen.add(id);
    list.push(asset);
  }
  return list.map(stubReserve);
}

export function budgetFromUsdc(usdc: bigint, decimals1: number, price1Usd: number, token1IsUsdc: boolean): bigint {
  if (token1IsUsdc) return usdc;
  if (!(price1Usd > 0)) throw new Error('Pool price is not ready');
  const price8 = BigInt(Math.round(price1Usd * 1e8));
  return (usdc * 10n ** BigInt(decimals1) * 100n) / price8;
}

export function findAsset(address: string): Asset {
  const found = [USDC, USDT, WBTC, WETH, LINK, AAVE, UNI].find((asset) => asset.address === address.toLowerCase());
  if (!found) throw new Error('Unknown asset');
  return found;
}

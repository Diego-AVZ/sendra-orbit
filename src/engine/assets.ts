/** Arbitrum One assets Sendra already trades. */
export type Asset = {
  symbol: string;
  address: string;
  decimals: number;
};

export const USDC: Asset = { symbol: 'USDC', address: '0xaf88d065e77c8cc2239327c5edb3a432268e5831', decimals: 6 };
export const WBTC: Asset = { symbol: 'WBTC', address: '0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f', decimals: 8 };
export const WETH: Asset = { symbol: 'WETH', address: '0x82af49447d8a07e3bd95bd0d56f35241523fbab1', decimals: 18 };
export const LINK: Asset = { symbol: 'LINK', address: '0xf97f4df75117a78c1a5a0dbb814af92458539fb4', decimals: 18 };
export const AAVE: Asset = { symbol: 'AAVE', address: '0xba5ddd1f9d7f570dc94a51479a000e3bce967196', decimals: 18 };
export const UNI: Asset = { symbol: 'UNI', address: '0xfa7f8980b0f1e64a2062791cc3b0871572f1f7f0', decimals: 18 };

export const ASSETS = { USDC, WBTC, WETH, LINK, AAVE, UNI } as const;
export const SPOT_ASSETS = [WBTC, WETH, LINK, AAVE, UNI] as const;

export function isSpotAsset(asset: Asset): boolean {
  return SPOT_ASSETS.some((item) => item.address === asset.address.toLowerCase());
}

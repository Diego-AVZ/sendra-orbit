import { withBase } from '@/lib/base';

const ICONS: Record<string, string> = {
  AAVE: '/assets/tokens/aave.png',
  BTC: '/assets/tokens/btc.png',
  ETH: '/assets/tokens/eth.png',
  LINK: '/assets/tokens/link.png',
  UNI: '/assets/tokens/uni.png',
  USDC: '/assets/tokens/usdc.png',
  USDT: '/assets/tokens/usdt.svg',
  'USD₮0': '/assets/tokens/usdt.svg',
  WBTC: '/assets/tokens/btc.png',
  WETH: '/assets/tokens/eth.png',
};

export function Token({ symbol, size = 16 }: { symbol: string; size?: number }) {
  const src = ICONS[symbol.toUpperCase()] ?? ICONS[symbol];
  if (!src) {
    return <span className="ob-fallback">{symbol.slice(0, 2)}</span>;
  }
  return <img src={withBase(src)} alt="" width={size} height={size} className="ob-token" />;
}

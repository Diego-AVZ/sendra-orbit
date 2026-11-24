import type { Candle } from './candles';

const GECKO = 'https://api.geckoterminal.com/api/v2';
const BINANCE: Record<string, string> = {
  WBTC: 'BTCUSDT',
  WETH: 'ETHUSDT',
  LINK: 'LINKUSDT',
  AAVE: 'AAVEUSDT',
  UNI: 'UNIUSDT',
};

type GeckoCandle = [number, number, number, number, number, number];

export async function fetchAssetCandles(symbol: string, sinceSec: number): Promise<Candle[]> {
  const pair = BINANCE[symbol];
  if (!pair) return [];
  const url = `https://api.binance.com/api/v3/klines?symbol=${pair}&interval=1h&startTime=${sinceSec * 1000}&limit=1000`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Binance ${response.status}`);
  const rows = (await response.json()) as unknown[];
  if (!Array.isArray(rows)) throw new Error('Binance candles');
  return rows.map((row) => {
    const candle = row as string[];
    return {
      time: Math.floor(Number(candle[0]) / 1000),
      open: Number(candle[1]),
      high: Number(candle[2]),
      low: Number(candle[3]),
      close: Number(candle[4]),
      volumeUsd: Number(candle[7]),
    };
  });
}

/**
 * Pool candles in Uniswap order: close is token1 per token0.
 * Volume is converted to USD with the pool's current quote price.
 */
export async function fetchPoolCandles(pool: string, token0: string, token1: string, sinceSec: number): Promise<Candle[]> {
  const meta = await poolMeta(pool);
  const raw = await ohlcv(pool, sinceSec);
  const base = meta.base;
  const tokenPrice = (close: number) => {
    if (base === token0.toLowerCase()) return close;
    if (base === token1.toLowerCase()) return close === 0 ? 0 : 1 / close;
    throw new Error('pool tokens do not match the position');
  };
  return raw.map((candle) => ({
    time: candle[0],
    open: tokenPrice(candle[1]),
    high: Math.max(tokenPrice(candle[2]), tokenPrice(candle[3])),
    low: Math.min(tokenPrice(candle[2]), tokenPrice(candle[3])),
    close: tokenPrice(candle[4]),
    volumeUsd: candle[5] * meta.quoteUsd,
  }));
}

export async function poolPrices(pool: string, token0: string, token1: string): Promise<{ price0Usd: number; price1Usd: number }> {
  const meta = await poolMeta(pool);
  const price = (token: string) => {
    if (token.toLowerCase() === meta.base) return meta.baseUsd;
    if (token.toLowerCase() === meta.quote) return meta.quoteUsd;
    throw new Error('pool tokens do not match the position');
  };
  return { price0Usd: price(token0), price1Usd: price(token1) };
}

async function poolMeta(pool: string): Promise<{ base: string; quote: string; baseUsd: number; quoteUsd: number }> {
  const json = await gecko(`/networks/arbitrum/pools/${pool}`);
  const data = json.data as {
    attributes: { base_token_price_usd: string; quote_token_price_usd: string };
    relationships: { base_token: { data: { id: string } }; quote_token: { data: { id: string } } };
  };
  return {
    base: addressOf(data.relationships.base_token.data.id),
    quote: addressOf(data.relationships.quote_token.data.id),
    baseUsd: Number(data.attributes.base_token_price_usd),
    quoteUsd: Number(data.attributes.quote_token_price_usd),
  };
}

async function ohlcv(pool: string, sinceSec: number): Promise<GeckoCandle[]> {
  const rows: GeckoCandle[] = [];
  let before: number | null = null;
  for (let page = 0; page < 6; page += 1) {
    const query = `/networks/arbitrum/pools/${pool}/ohlcv/hour?aggregate=1&limit=1000&currency=token${before ? `&before_timestamp=${before}` : ''}`;
    const json = await gecko(query);
    const list = ((json.data as { attributes?: { ohlcv_list?: GeckoCandle[] } }).attributes?.ohlcv_list ?? []) as GeckoCandle[];
    if (!list.length) break;
    rows.push(...list);
    const oldest = list[list.length - 1][0];
    if (oldest <= sinceSec) break;
    before = oldest;
  }
  return rows
    .filter((candle) => candle[0] >= sinceSec)
    .sort((a, b) => a[0] - b[0]);
}

function addressOf(id: string): string {
  return (id.split('_').pop() ?? '').toLowerCase();
}

async function gecko(path: string): Promise<Record<string, unknown>> {
  const response = await fetch(`${GECKO}${path}`, { headers: { accept: 'application/json' } });
  if (response.status === 429) throw new Error('GeckoTerminal rate limit');
  if (!response.ok) throw new Error(`GeckoTerminal ${response.status}`);
  return (await response.json()) as Record<string, unknown>;
}

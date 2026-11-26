import type { Asset } from './assets';
import type { Candle } from './candles';
import { readPriceUsd } from './chain';

function onLocalhost(): boolean {
  return typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
}

function binanceRoot(): string {
  return onLocalhost() ? '/binance' : 'https://api.binance.com';
}

function geckoRoot(): string {
  return onLocalhost() ? '/gecko/api/v2' : 'https://api.geckoterminal.com/api/v2';
}
const BINANCE: Record<string, string> = {
  WBTC: 'BTCUSDT',
  WETH: 'ETHUSDT',
  LINK: 'LINKUSDT',
  AAVE: 'AAVEUSDT',
  UNI: 'UNIUSDT',
};

const COINBASE: Record<string, string> = {
  WBTC: 'BTC-USD',
  WETH: 'ETH-USD',
  LINK: 'LINK-USD',
  AAVE: 'AAVE-USD',
  UNI: 'UNI-USD',
};

export type BarInterval = '15m' | '1h' | '4h' | '1d';

const BINANCE_INTERVAL: Record<BarInterval, string> = { '15m': '15m', '1h': '1h', '4h': '4h', '1d': '1d' };
const COINBASE_GRANULARITY: Record<BarInterval, number> = { '15m': 900, '1h': 3600, '4h': 14400, '1d': 86400 };

function coinbaseRoot(): string {
  return onLocalhost() ? '/coinbase' : 'https://api.exchange.coinbase.com';
}

type GeckoCandle = [number, number, number, number, number, number];

/** Oracle price, then the last Binance or Coinbase trade. */
export async function assetPriceUsd(asset: Asset, rpc?: string): Promise<number> {
  try {
    const price = await readPriceUsd(asset, rpc);
    if (price > 0) return price;
  } catch {
    /* listed markets still have a candle */
  }
  const since = Math.floor(Date.now() / 1000) - 6 * 3600;
  const candles = await fetchAssetCandles(asset.symbol, since, '1h').catch(() => []);
  const close = candles.at(-1)?.close ?? 0;
  if (close > 0) return close;
  throw new Error(`${asset.symbol} price unavailable`);
}

export async function fetchAssetCandles(symbol: string, sinceSec: number, interval: BarInterval = '1h'): Promise<Candle[]> {
  const pair = BINANCE[symbol];
  const product = COINBASE[symbol];
  if (!pair && !product) return [];
  try {
    if (!pair) throw new Error('no binance market');
    return await binanceCandles(pair, interval, sinceSec);
  } catch (error) {
    if (!product) throw error;
    return coinbaseCandles(product, interval, sinceSec);
  }
}

async function binanceCandles(pair: string, interval: BarInterval, sinceSec: number): Promise<Candle[]> {
  const step = COINBASE_GRANULARITY[interval];
  const now = Math.floor(Date.now() / 1000);
  const start = Math.max(Math.floor(sinceSec), now - step * 999);
  const url = `${binanceRoot()}/api/v3/klines?symbol=${pair}&interval=${BINANCE_INTERVAL[interval]}&startTime=${start * 1000}&endTime=${now * 1000}&limit=1000`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Binance ${response.status}`);
  const rows = (await response.json()) as unknown;
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
  }).filter((candle) => candle.close > 0);
}

async function coinbaseCandles(product: string, interval: BarInterval, sinceSec: number): Promise<Candle[]> {
  const granularity = COINBASE_GRANULARITY[interval];
  const now = Math.floor(Date.now() / 1000);
  const span = granularity * 280;
  const rows: Candle[] = [];
  for (let end = now; end > sinceSec && rows.length < 1000; end -= span) {
    const start = Math.max(sinceSec, end - span);
    const url = `${coinbaseRoot()}/products/${product}/candles?granularity=${granularity}&start=${encodeURIComponent(new Date(start * 1000).toISOString())}&end=${encodeURIComponent(new Date(end * 1000).toISOString())}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Coinbase ${response.status}`);
    const list = (await response.json()) as number[][];
    if (!Array.isArray(list)) throw new Error('Coinbase candles');
    for (const row of list) {
      if (!(row[4] > 0)) continue;
      rows.push({
        time: row[0],
        low: row[1],
        high: row[2],
        open: row[3],
        close: row[4],
        volumeUsd: row[5] * row[4],
      });
    }
  }
  const byTime = new Map<number, Candle>();
  for (const candle of rows) byTime.set(candle.time, candle);
  return [...byTime.values()].filter((candle) => candle.time >= sinceSec).sort((a, b) => a.time - b.time);
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

const GRAPH_ID = 'FbCGRftH4a3yZugY7TnbYgPJVEv2LvMT6oF1fxPe9aJM';
const STABLES = new Set(['usdc', 'usdt', 'dai', 'usdc.e', 'usdce', 'usdbc', 'usdt0', 'busd', 'frax', 'lusd']);

export type LabsStat = {
  pool: string;
  tvlUsd: number;
  /** Fee tier × yesterday's volume / single-side TVL × 365. The figure Labs prints as Pool APR. */
  poolApr: number;
  /** What a full-range position earns. Same formula as Sendra Labs. */
  fullRangeApr: number | null;
};

type GraphPool = {
  id: string;
  feeTier: string;
  liquidity: string;
  totalValueLockedUSD: string;
  totalValueLockedToken0: string;
  totalValueLockedToken1: string;
  token0: { symbol: string; decimals: string };
  token1: { symbol: string; decimals: string; derivedETH: string };
  token1Price: string;
  poolDayData: { volumeUSD: string; feesUSD: string }[];
};

/** Labs whitelist, with the pools Labs itself hides already removed. */
export async function fetchLabsStats(pools: string[]): Promise<LabsStat[]> {
  const key = typeof import.meta !== 'undefined' ? import.meta.env?.VITE_GRAPH_API_KEY : undefined;
  if (!key) throw new Error('Missing VITE_GRAPH_API_KEY');
  const ids = pools.map((pool) => `"${pool.toLowerCase()}"`).join(', ');
  const query = `query { pools(where: { id_in: [${ids}] }) { id feeTier liquidity totalValueLockedUSD totalValueLockedToken0 totalValueLockedToken1 token0 { symbol decimals } token1 { symbol decimals derivedETH } token1Price poolDayData(first: 8, orderBy: date, orderDirection: desc) { volumeUSD feesUSD } } bundle(id: "1") { ethPriceUSD } }`;
  const response = await fetch(`https://gateway.thegraph.com/api/${key}/subgraphs/id/${GRAPH_ID}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!response.ok) throw new Error(`Subgraph ${response.status}`);
  const json = (await response.json()) as { data?: { pools?: GraphPool[]; bundle?: { ethPriceUSD: string } }; errors?: { message: string }[] };
  const eth = Number(json.data?.bundle?.ethPriceUSD ?? 0);
  if (json.errors?.length || !(eth > 0)) throw new Error(json.errors?.[0]?.message ?? 'Subgraph');
  return (json.data?.pools ?? []).flatMap((pool) => {
    const symbol0 = pool.token0.symbol.toLowerCase();
    const symbol1 = pool.token1.symbol.toLowerCase();
    const locked0 = Number(pool.totalValueLockedToken0);
    const locked1 = Number(pool.totalValueLockedToken1);
    const tvl = STABLES.has(symbol1) && locked1 > 0 ? locked1 : STABLES.has(symbol0) && locked0 > 0 ? locked0 : Number(pool.totalValueLockedUSD) / 2;
    const days = (pool.poolDayData ?? []).slice(1, 8);
    const volume = days.length ? Number(days[0].volumeUSD) : 0;
    const fee = Number(pool.feeTier) / 1_000_000;
    const poolApr = fee > 0 && tvl > 0 ? (fee * volume * 365 / tvl) * 100 : 0;
    if (!(tvl >= 25_000) || !(volume > 0) || !(poolApr >= 0.05)) return [];
    const fees = days.reduce((sum, day) => sum + Number(day.feesUSD), 0) / days.length;
    const liquidity = Number(pool.liquidity) / 10 ** ((Number(pool.token0.decimals) + Number(pool.token1.decimals)) / 2);
    const price = Number(pool.token1Price);
    const token1Usd = Number(pool.token1.derivedETH) * eth;
    const value = 2 * liquidity * Math.sqrt(price) * token1Usd;
    const fullRangeApr = value > 0 && fees >= 0 ? ((fees * 365) / value) * 100 : null;
    return [{ pool: pool.id.toLowerCase(), tvlUsd: tvl, poolApr, fullRangeApr }];
  });
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
  const response = await fetch(`${geckoRoot()}${path}`, { headers: { accept: 'application/json' } });
  if (response.status === 429) throw new Error('GeckoTerminal rate limit');
  if (!response.ok) throw new Error(`GeckoTerminal ${response.status}`);
  return (await response.json()) as Record<string, unknown>;
}

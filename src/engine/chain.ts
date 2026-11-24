import type { Asset } from './assets';
import type { Reserve } from './aave';
import { inRange, sqrtPriceAtTick } from './tick';
import { sub256 } from './units';

export const AAVE_POOL = '0x794a61358d6845594f94dc1db02a252b5b4814ad';
export const AAVE_DATA = '0x69fa688f1dc47d4b5d8029d5a35fb7a548310654';
const DEFAULT_RPC = 'https://arb1.arbitrum.io/rpc';

const SLOT0 = '0x3850c7bd';
const LIQUIDITY = '0x1a686502';
const FEE_GROWTH_0 = '0xf3058399';
const FEE_GROWTH_1 = '0x46141319';
const TICKS = '0xf30dba93';
const RESERVE_DATA = '0x35ea6a75';
const RESERVE_CONFIG = '0x3e150141';
const ASSET_PRICE = '0xb3596f07';
const ADDRESSES_PROVIDER = '0x0542975c';
const PRICE_ORACLE = '0xfca513a8';

export function rpcUrl(): string {
  const configured = typeof import.meta !== 'undefined' ? import.meta.env?.VITE_ARBITRUM_RPC : undefined;
  return configured || DEFAULT_RPC;
}

export type PoolSnapshot = {
  sqrtPriceX96: bigint;
  tick: number;
  liquidity: bigint;
  feeGrowthInside0: bigint;
  feeGrowthInside1: bigint;
};

export async function readPool(pool: string, tickLower: number, tickUpper: number, rpc = rpcUrl()): Promise<PoolSnapshot> {
  const [slot0, liquidity, growth0, growth1, lower, upper] = await batch(rpc, [
    { to: pool, data: SLOT0 },
    { to: pool, data: LIQUIDITY },
    { to: pool, data: FEE_GROWTH_0 },
    { to: pool, data: FEE_GROWTH_1 },
    { to: pool, data: TICKS + encodeInt24(tickLower) },
    { to: pool, data: TICKS + encodeInt24(tickUpper) },
  ]);
  const sqrtPriceX96 = word(slot0, 0);
  const global0 = word(growth0, 0);
  const global1 = word(growth1, 0);
  const sqrtLower = sqrtPriceAtTick(tickLower);
  const sqrtUpper = sqrtPriceAtTick(tickUpper);
  const aboveLower = inRange(sqrtPriceX96, sqrtLower, sqrtUpper) || sqrtPriceX96 >= sqrtLower;
  const belowUpper = sqrtPriceX96 < sqrtUpper;
  return {
    sqrtPriceX96,
    tick: Number(signed(word(slot0, 1))),
    liquidity: word(liquidity, 0),
    feeGrowthInside0: inside(global0, word(lower, 2), word(upper, 2), aboveLower, belowUpper),
    feeGrowthInside1: inside(global1, word(lower, 3), word(upper, 3), aboveLower, belowUpper),
  };
}

let oracleAddress: string | null = null;

export async function readReserve(asset: Asset, rpc = rpcUrl()): Promise<Reserve> {
  const oracle = await priceOracle(rpc);
  const padded = padAddress(asset.address);
  const [data, config, price] = await batch(rpc, [
    { to: AAVE_DATA, data: RESERVE_DATA + padded },
    { to: AAVE_DATA, data: RESERVE_CONFIG + padded },
    { to: oracle, data: ASSET_PRICE + padded },
  ]);
  const active = word(config, 8) === 1n;
  if (!active) throw new Error(`${asset.symbol} reserve is not active`);
  return {
    asset,
    priceUsd: Number(word(price, 0)) / 1e8,
    ltvBps: Number(word(config, 1)),
    liquidationThresholdBps: Number(word(config, 2)),
    liquidationBonusBps: Number(word(config, 3)),
    collateralEnabled: word(config, 5) === 1n,
    borrowingEnabled: word(config, 6) === 1n,
    liquidityIndex: word(data, 9),
    variableBorrowIndex: word(data, 10),
    liquidityRate: word(data, 5),
    variableBorrowRate: word(data, 6),
  };
}

async function priceOracle(rpc: string): Promise<string> {
  if (oracleAddress) return oracleAddress;
  const provider = word(await call(rpc, AAVE_POOL, ADDRESSES_PROVIDER), 0);
  const oracle = word(await call(rpc, addressOf(provider), PRICE_ORACLE), 0);
  oracleAddress = addressOf(oracle);
  return oracleAddress;
}

function inside(global: bigint, lowerOutside: bigint, upperOutside: bigint, aboveLower: boolean, belowUpper: boolean): bigint {
  const below = aboveLower ? lowerOutside : sub256(global, lowerOutside);
  const above = belowUpper ? upperOutside : sub256(global, upperOutside);
  return sub256(sub256(global, below), above);
}

function addressOf(wordValue: bigint): string {
  return `0x${wordValue.toString(16).padStart(40, '0').slice(-40)}`;
}

function padAddress(address: string): string {
  return address.toLowerCase().replace('0x', '').padStart(64, '0');
}

function encodeInt24(tick: number): string {
  const value = tick < 0 ? (1n << 256n) + BigInt(tick) : BigInt(tick);
  return value.toString(16).padStart(64, '0');
}

function word(data: string, index: number): bigint {
  const hex = data.startsWith('0x') ? data.slice(2) : data;
  const slice = hex.slice(index * 64, index * 64 + 64);
  if (slice.length !== 64) throw new Error('short eth_call result');
  return BigInt(`0x${slice}`);
}

function signed(value: bigint): bigint {
  return value >= 1n << 255n ? value - (1n << 256n) : value;
}

type Call = { to: string; data: string };

async function call(rpc: string, to: string, data: string): Promise<string> {
  const [result] = await batch(rpc, [{ to, data }]);
  return result;
}

async function batch(rpc: string, calls: Call[]): Promise<string[]> {
  const body = calls.map((item, id) => ({
    jsonrpc: '2.0',
    id,
    method: 'eth_call',
    params: [{ to: item.to, data: item.data }, 'latest'],
  }));
  const response = await fetch(rpc, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`rpc ${response.status}`);
  const json = (await response.json()) as Array<{ id: number; result?: string; error?: { message: string } }> | { result?: string; error?: { message: string } };
  const rows = Array.isArray(json) ? json : [{ id: 0, ...json }];
  return calls.map((_, id) => {
    const row = rows.find((item) => item.id === id);
    if (!row?.result) throw new Error(row?.error?.message ?? 'eth_call failed');
    return row.result;
  });
}

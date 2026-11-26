import { supabaseConfig } from './store';
import { EVAL_RULES, planName, type Plan } from '@/lib/plans';

export type AccountStatus = 'active' | 'passed' | 'failed';
export type ClosedReason = 'daily' | 'total' | 'target' | null;

export type EvalAccount = {
  id: string;
  operatorId: string;
  wallet: string;
  tier: string;
  name: string;
  capitalUsd: number;
  priceUsd: number;
  profitTargetPct: number;
  dailyLossPct: number;
  totalLossPct: number;
  status: AccountStatus;
  closedReason: ClosedReason;
  dayUtc: string;
  dayEquityUsd: number;
  createdAt: string;
};

type OperatorRow = { id: string; wallet: string };
type AccountRow = {
  id: string;
  operator_id: string;
  wallet: string;
  tier: string;
  capital_usd: number | string;
  price_usd: number | string;
  profit_target_pct: number | string;
  daily_loss_pct: number | string;
  total_loss_pct: number | string;
  status: AccountStatus;
  closed_reason: ClosedReason;
  day_utc: string;
  day_equity_usd: number | string;
  created_at: string;
};

const CACHE = 'sendra-orbit.accounts';
export const ACCOUNT_KEY = 'sendra-orbit.account';

type Ethereum = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
};

function provider(): Ethereum | null {
  const eth = (window as Window & { ethereum?: Ethereum }).ethereum;
  return eth?.request ? eth : null;
}

function asAddress(value: unknown): string | null {
  return typeof value === 'string' && value.startsWith('0x') ? value.toLowerCase() : null;
}

export function utcDay(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export async function readConnectedWallet(): Promise<string | null> {
  const eth = provider();
  if (!eth) return null;
  const accounts = await eth.request({ method: 'eth_accounts' });
  return Array.isArray(accounts) ? asAddress(accounts[0]) : null;
}

export async function connectWallet(): Promise<string> {
  const eth = provider();
  if (!eth) throw new Error('Install a wallet extension to buy an evaluation.');
  const accounts = await eth.request({ method: 'eth_requestAccounts' });
  const wallet = Array.isArray(accounts) ? asAddress(accounts[0]) : null;
  if (!wallet) throw new Error('The wallet did not return an account.');
  return wallet;
}

export function watchWallet(onChange: (wallet: string | null) => void): () => void {
  const eth = provider();
  if (!eth?.on) return () => undefined;
  const handler = (accounts: unknown) => {
    onChange(Array.isArray(accounts) ? asAddress(accounts[0]) : null);
  };
  eth.on('accountsChanged', handler);
  return () => eth.removeListener?.('accountsChanged', handler);
}

export function shortWallet(wallet: string): string {
  return `${wallet.slice(0, 6)}…${wallet.slice(-4)}`;
}

export function readCache(wallet: string): EvalAccount[] {
  try {
    const all = JSON.parse(localStorage.getItem(CACHE) ?? '{}') as Record<string, EvalAccount[]>;
    return all[wallet] ?? [];
  } catch {
    return [];
  }
}

export function cacheAccounts(wallet: string, accounts: EvalAccount[]) {
  const all = (() => {
    try {
      return JSON.parse(localStorage.getItem(CACHE) ?? '{}') as Record<string, EvalAccount[]>;
    } catch {
      return {};
    }
  })();
  all[wallet] = accounts;
  localStorage.setItem(CACHE, JSON.stringify(all));
}

function num(value: number | string): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function fromRow(row: AccountRow): EvalAccount {
  return {
    id: row.id,
    operatorId: row.operator_id,
    wallet: row.wallet,
    tier: row.tier,
    name: planName(row.tier),
    capitalUsd: num(row.capital_usd),
    priceUsd: num(row.price_usd),
    profitTargetPct: num(row.profit_target_pct),
    dailyLossPct: num(row.daily_loss_pct),
    totalLossPct: num(row.total_loss_pct),
    status: row.status,
    closedReason: row.closed_reason,
    dayUtc: row.day_utc,
    dayEquityUsd: num(row.day_equity_usd),
    createdAt: row.created_at,
  };
}

async function request<T>(path: string, init: { method?: string; body?: unknown; prefer?: string } = {}): Promise<T> {
  const config = supabaseConfig();
  if (!config) throw new Error('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    method: init.method ?? 'GET',
    headers: {
      apikey: config.key,
      authorization: `Bearer ${config.key}`,
      'content-type': 'application/json',
      prefer: init.prefer ?? 'return=representation',
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (!response.ok) {
    const text = await response.text();
    if (/operators|accounts|schema cache|PGRST/i.test(text)) {
      throw new Error('Accounts are not in Supabase yet. Apply supabase/accounts.sql.');
    }
    throw new Error(`Supabase ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function loadAccounts(wallet: string): Promise<EvalAccount[]> {
  try {
    const rows = await request<AccountRow[]>(
      `accounts?wallet=eq.${encodeURIComponent(wallet)}&select=*&order=created_at.desc`,
    );
    const accounts = rows.map(fromRow);
    cacheAccounts(wallet, accounts);
    return accounts;
  } catch (error) {
    const cached = readCache(wallet);
    if (cached.length) return cached;
    throw error;
  }
}

export async function purchase(wallet: string, plan: Plan): Promise<EvalAccount> {
  const operators = await request<OperatorRow[]>('operators?on_conflict=wallet', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=representation',
    body: { wallet },
  });
  const operator = operators[0];
  if (!operator) throw new Error('Supabase did not store this wallet.');
  const today = utcDay();
  const created = await request<AccountRow[]>('accounts', {
    method: 'POST',
    body: {
      id: crypto.randomUUID(),
      operator_id: operator.id,
      wallet,
      tier: plan.id,
      capital_usd: plan.capital,
      price_usd: plan.price,
      profit_target_pct: EVAL_RULES.profitTarget,
      daily_loss_pct: EVAL_RULES.dailyLoss,
      total_loss_pct: EVAL_RULES.totalLoss,
      status: 'active',
      closed_reason: null,
      day_utc: today,
      day_equity_usd: plan.capital,
    },
  });
  const account = created[0] ? fromRow(created[0]) : null;
  if (!account) throw new Error('Supabase did not store this account.');
  cacheAccounts(wallet, [account, ...readCache(wallet).filter((item) => item.id !== account.id)]);
  localStorage.setItem(ACCOUNT_KEY, account.id);
  return account;
}

export async function saveAccount(account: EvalAccount): Promise<void> {
  await request(`accounts?id=eq.${account.id}`, {
    method: 'PATCH',
    body: {
      status: account.status,
      closed_reason: account.closedReason,
      day_utc: account.dayUtc,
      day_equity_usd: account.dayEquityUsd,
    },
  });
}

/** Returns the next account when the day rolls or a rule closes the evaluation. */
export function reviewAccount(account: EvalAccount, equity: number): EvalAccount | null {
  if (account.status !== 'active') return null;
  const today = utcDay();
  let dayUtc = account.dayUtc;
  let dayEquityUsd = account.dayEquityUsd;
  if (dayUtc !== today) {
    dayUtc = today;
    dayEquityUsd = equity;
  }
  let status: AccountStatus = 'active';
  let closedReason: ClosedReason = null;
  const daily = dayEquityUsd - equity;
  const total = account.capitalUsd - equity;
  const profit = equity - account.capitalUsd;
  if (daily >= account.capitalUsd * account.dailyLossPct - 0.005) {
    status = 'failed';
    closedReason = 'daily';
  } else if (total >= account.capitalUsd * account.totalLossPct - 0.005) {
    status = 'failed';
    closedReason = 'total';
  } else if (profit >= account.capitalUsd * account.profitTargetPct - 0.005) {
    status = 'passed';
    closedReason = 'target';
  }
  if (status === 'active' && dayUtc === account.dayUtc && Math.abs(dayEquityUsd - account.dayEquityUsd) < 0.005) return null;
  return { ...account, status, closedReason, dayUtc, dayEquityUsd };
}

export function statusLine(account: EvalAccount): string {
  if (account.status === 'passed') return 'Profit target reached. This evaluation is closed.';
  if (account.closedReason === 'daily') return 'Daily loss reached 2% of the account. This evaluation is closed.';
  if (account.closedReason === 'total') return 'Total loss reached 6% of the account. This evaluation is closed.';
  if (account.status === 'failed') return 'This evaluation is closed.';
  return 'Evaluation active';
}

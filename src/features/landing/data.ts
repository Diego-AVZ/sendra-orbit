export const ACCOUNTS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 25,
    capital: 3000,
    line: 'A first book. Learn the rules on a defined evaluation.',
  },
  {
    id: 'advanced',
    name: 'Advanced',
    price: 49,
    capital: 5000,
    line: 'The working size for a full challenge.',
  },
  {
    id: 'professional',
    name: 'Professional',
    price: 99,
    capital: 10000,
    line: 'A larger virtual allocation under the same standard.',
  },
] as const;

export type AccountId = (typeof ACCOUNTS)[number]['id'];

export const TIERS = [{ id: 'general', name: 'Not sure yet' }, ...ACCOUNTS] as const;

export const PATH = [
  {
    n: '01',
    title: 'Orbit Challenge',
    body: 'Buy an evaluation with a defined virtual allocation. The window, the target and the limits are published before you pay.',
  },
  {
    n: '02',
    title: 'Orbit Paper',
    body: 'Operate that capital on live market data. Uniswap ranges, Aave books and spot positions follow the mechanics of the protocols.',
  },
  {
    n: '03',
    title: 'Orbit Funded',
    body: 'Pass the rules and become eligible for a real allocation. Profits are shared. The first capital is company-owned, and small on purpose.',
  },
] as const;

export const TERMS = [
  { name: 'Orbit Challenge', line: 'The paid evaluation.' },
  { name: 'Orbit Paper', line: 'The simulated book.' },
  { name: 'Orbit Funded', line: 'Real capital, after you qualify.' },
  { name: 'Orbit Score', line: 'Performance and risk, in one record.' },
  { name: 'Orbit Reputation', line: 'A history you can carry forward.' },
] as const;

export const RULES = {
  lp: {
    label: 'Uniswap LP',
    lines: [
      ['Equity', 'Fees and unrealized impermanent loss sit inside the result.'],
      ['Daily loss', 'Set for a liquidity book, with its own volatility.'],
      ['Exposure', 'Range width and pool concentration have caps.'],
      ['Activity', 'Time spent out of range is part of the record.'],
    ],
  },
  aave: {
    label: 'Aave',
    lines: [
      ['Health factor', 'A floor. Cross it and the evaluation ends.'],
      ['Borrowing', 'A cap on how far the book can lever.'],
      ['Yield', 'Interest accrual is part of the P&L.'],
      ['Liquidation', 'Protocol liquidation risk fails the account.'],
    ],
  },
  spot: {
    label: 'Spot',
    lines: [
      ['Concentration', 'A cap on any single asset.'],
      ['Costs', 'Fees and slippage sit inside the P&L.'],
      ['Marks', 'The book is valued on actual prices.'],
      ['Inactivity', 'A silent account does not stay open forever.'],
    ],
  },
} as const;

export type RuleId = keyof typeof RULES;

export const INCLUDED = [
  'Defined evaluation period',
  'Profit target, where it applies',
  'Daily loss limit',
  'Maximum total drawdown',
  'Strategy-specific rules',
  'Position and exposure limits',
] as const;

export function usd(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

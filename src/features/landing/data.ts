export { ACCOUNTS, COMING, RULE_LINES, type AccountId } from '@/lib/plans';

export const PATH = [
  {
    n: '01',
    title: 'Orbit Challenge',
    body: 'The first phase, fully simulated. Buy the evaluation. The window, the target and the limits are published before you pay.',
  },
  {
    n: '02',
    title: 'Orbit Real',
    body: 'The next phase, on mainnet. A small allocation of real capital, still inside the rules. If the book is profitable, you are paid.',
  },
  {
    n: '03',
    title: 'Orbit Funded',
    body: 'Pass both phases and the cap comes off. You manage the full allocation. Profits are shared.',
  },
] as const;

export const TERMS = [
  { name: 'Orbit Challenge', line: 'Simulated capital. The first evaluation.' },
  { name: 'Orbit Real', line: 'Limited real capital on mainnet. Profits are paid.' },
  { name: 'Orbit Funded', line: 'The full allocation, after you qualify.' },
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

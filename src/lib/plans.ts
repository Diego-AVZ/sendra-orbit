export const EVAL_RULES = {
  profitTarget: 0.1,
  dailyLoss: 0.02,
  totalLoss: 0.06,
} as const;

export const ACCOUNTS = [
  { id: 'starter', name: 'Starter', badge: 'Entry level', price: 10, capital: 1_000 },
  { id: 'advanced', name: 'Advanced', badge: 'Popular', price: 35, capital: 5_000 },
  { id: 'professional', name: 'Professional', badge: null, price: 55, capital: 10_000 },
  { id: 'elite', name: 'Elite', badge: null, price: 125, capital: 25_000 },
] as const;

export const COMING = [
  { id: 'master', name: 'Master', capital: 50_000, price: 249 },
  { id: 'institutional', name: 'Institutional', capital: 100_000, price: 449 },
] as const;

export type AccountId = (typeof ACCOUNTS)[number]['id'];
export type Plan = (typeof ACCOUNTS)[number];

export const RULE_LINES = [
  `Profit target: ${EVAL_RULES.profitTarget * 100}%`,
  `Max daily loss: ${EVAL_RULES.dailyLoss * 100}%`,
  `Max total loss: ${EVAL_RULES.totalLoss * 100}%`,
] as const;

export function planById(id: string): Plan | undefined {
  return ACCOUNTS.find((plan) => plan.id === id);
}

export function planName(id: string): string {
  return planById(id)?.name ?? COMING.find((plan) => plan.id === id)?.name ?? id;
}

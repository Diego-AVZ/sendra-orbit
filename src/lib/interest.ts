const KEY = 'orbit-interest';

export type Interest = {
  email: string;
  tier: string;
  at: string;
};

export function readInterest(): Interest | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Interest>;
    if (!parsed.email || !parsed.tier || !parsed.at) return null;
    return { email: parsed.email, tier: parsed.tier, at: parsed.at };
  } catch {
    return null;
  }
}

export function saveInterest(interest: Interest) {
  localStorage.setItem(KEY, JSON.stringify(interest));
  window.dispatchEvent(new Event('orbit-interest'));
}

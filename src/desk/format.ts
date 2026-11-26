export function usd(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return '—';
  const sign = value < 0 ? '−' : '';
  const abs = Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return `${sign}$${abs}`;
}

export function signedUsd(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const body = usd(Math.abs(value));
  if (value > 0) return `+${body}`;
  if (value < 0) return `−${body}`;
  return body;
}

export function price(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const digits = value >= 1000 ? 2 : value >= 1 ? 2 : value >= 0.01 ? 4 : 6;
  return value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function signedPct(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const body = `${Math.abs(value).toFixed(2)}%`;
  if (value > 0) return `+${body}`;
  if (value < 0) return `−${body}`;
  return body;
}

export function tone(value: number): string {
  if (value > 0) return 'up';
  if (value < 0) return 'down';
  return 'flat';
}

export function changeOver(candles: { time: number; open: number; close: number }[], seconds: number): number | null {
  if (candles.length < 2) return null;
  const last = candles[candles.length - 1];
  const target = last.time - seconds;
  let base = candles[0];
  for (const candle of candles) {
    if (candle.time <= target) base = candle;
  }
  if (!(base.open > 0) || !(last.close > 0)) return null;
  return (last.close / base.open - 1) * 100;
}

export function usdcRaw(amount: number): bigint {
  if (!(amount > 0) || !Number.isFinite(amount)) throw new Error('Enter an amount');
  return BigInt(Math.round(amount * 1_000_000));
}

/** Same cuts Sendra Labs uses for a full-range APR. */
export function aprText(value: number | null): string {
  if (value == null || !Number.isFinite(value) || value < 0) return '—';
  if (value === 0) return '0%';
  if (value < 0.1) return '<0.1%';
  if (value < 10) return `${value.toFixed(1)}%`;
  return `${Math.round(value).toLocaleString('en-US')}%`;
}

export function feeLabel(pips: number): string {
  return `${(pips / 10_000).toLocaleString('en-US', { maximumFractionDigits: 2 })}%`;
}

export function note(error: unknown): string {
  const text = error instanceof Error ? error.message : 'Something failed';
  return text.length > 280 ? `${text.slice(0, 280)}…` : text;
}

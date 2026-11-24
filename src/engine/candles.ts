export type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volumeUsd: number;
};

export function sortCandles(candles: Candle[]): Candle[] {
  return [...candles].sort((a, b) => a.time - b.time);
}

export function candleSpan(candles: Candle[], index: number, fallback: number): number {
  const next = candles[index + 1];
  if (next && next.time > candles[index].time) return next.time - candles[index].time;
  const previous = candles[index - 1];
  if (previous && candles[index].time > previous.time) return candles[index].time - previous.time;
  return fallback;
}

/** Fraction of a candle's range that sits inside [lower, upper). */
export function overlapFraction(low: number, high: number, lower: number, upper: number): number {
  if (!(upper > lower) || !(high >= low)) return 0;
  const lo = Math.max(low, lower);
  const hi = Math.min(high, upper);
  if (hi <= lo) return 0;
  if (high === low) return 1;
  return (hi - lo) / (high - low);
}

export function feesFromCandles(
  candles: Candle[],
  lower: number,
  upper: number,
  feePips: number,
  share: number,
  fallbackSeconds: number,
): { feesUsd: number; seconds: number; secondsInRange: number; cumulative: number[] } {
  const ordered = sortCandles(candles);
  let fees = 0;
  let seconds = 0;
  let secondsInRange = 0;
  const cumulative: number[] = [];
  for (let i = 0; i < ordered.length; i += 1) {
    const candle = ordered[i];
    const span = candleSpan(ordered, i, fallbackSeconds);
    const fraction = overlapFraction(candle.low, candle.high, lower, upper);
    seconds += span;
    secondsInRange += span * fraction;
    fees += candle.volumeUsd * (feePips / 1_000_000) * fraction * share;
    cumulative.push(fees);
  }
  return { feesUsd: fees, seconds, secondsInRange, cumulative };
}

export function liquidityShare(user: bigint, pool: bigint): number {
  if (user <= 0n) return 0;
  if (pool <= 0n) return 1;
  return Number((user * 1_000_000n) / (pool + user)) / 1e6;
}

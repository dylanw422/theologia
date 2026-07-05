// Cost + time-window math for usage metering. Rates are standard (non-intro)
// Anthropic API pricing in micro-USD per token ($/MTok == microUsd/token).

export type TokenCounts = {
  uncachedInputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
};

type Rate = {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
};

const MODEL_RATES: Record<string, Rate> = {
  "claude-sonnet-5": { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  "claude-haiku-4-5": { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 },
};

export function costMicroUsd(model: string, tokens: TokenCounts): number {
  const rate = MODEL_RATES[model] ?? MODEL_RATES["claude-sonnet-5"];
  if (!(model in MODEL_RATES)) {
    console.warn(`usageMath: unknown model "${model}", billing at sonnet-5 rate`);
  }
  return Math.ceil(
    tokens.uncachedInputTokens * rate.input +
      tokens.outputTokens * rate.output +
      tokens.cacheReadTokens * rate.cacheRead +
      tokens.cacheWriteTokens * rate.cacheWrite,
  );
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function weekStartUtc(now: number): number {
  const d = new Date(now);
  const daysSinceMonday = (d.getUTCDay() + 6) % 7;
  return (
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) -
    daysSinceMonday * DAY_MS
  );
}

export function nextWeeklyResetUtc(now: number): number {
  return weekStartUtc(now) + 7 * DAY_MS;
}

export function monthStartUtc(now: number): number {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
}

export function nextMonthlyResetUtc(now: number): number {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
}

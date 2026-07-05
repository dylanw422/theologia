import { describe, expect, test } from "vitest";

import {
  costMicroUsd,
  monthStartUtc,
  nextMonthlyResetUtc,
  nextWeeklyResetUtc,
  weekStartUtc,
} from "./usageMath";

describe("costMicroUsd", () => {
  test("sonnet-5 typical query: 8k cached-read input, 500 uncached, 1.5k output", () => {
    // 500 × 3 + 1500 × 15 + 8000 × 0.3 + 0 = 1500 + 22500 + 2400 = 26400
    expect(
      costMicroUsd("claude-sonnet-5", {
        uncachedInputTokens: 500,
        outputTokens: 1500,
        cacheReadTokens: 8000,
        cacheWriteTokens: 0,
      }),
    ).toBe(26_400);
  });

  test("haiku rates", () => {
    // 1000 × 1 + 1000 × 5 + 1000 × 0.1 + 1000 × 1.25 = 7350
    expect(
      costMicroUsd("claude-haiku-4-5", {
        uncachedInputTokens: 1000,
        outputTokens: 1000,
        cacheReadTokens: 1000,
        cacheWriteTokens: 1000,
      }),
    ).toBe(7_350);
  });

  test("rounds fractional micro-USD up", () => {
    // 1 cache-read token on sonnet = 0.3 microUsd → ceil to 1
    expect(
      costMicroUsd("claude-sonnet-5", {
        uncachedInputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 1,
        cacheWriteTokens: 0,
      }),
    ).toBe(1);
  });

  test("unknown model bills at the sonnet-5 rate", () => {
    const tokens = {
      uncachedInputTokens: 100,
      outputTokens: 100,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    };
    expect(costMicroUsd("mystery-model", tokens)).toBe(
      costMicroUsd("claude-sonnet-5", tokens),
    );
  });
});

describe("week boundaries (Monday 00:00 UTC)", () => {
  // 2026-07-04 is a Saturday; the week started Monday 2026-06-29.
  const saturday = Date.UTC(2026, 6, 4, 15, 30);

  test("weekStartUtc from a mid-week instant", () => {
    expect(weekStartUtc(saturday)).toBe(Date.UTC(2026, 5, 29));
  });

  test("a Monday at 00:00 UTC is its own week start", () => {
    const monday = Date.UTC(2026, 5, 29);
    expect(weekStartUtc(monday)).toBe(monday);
  });

  test("Sunday belongs to the previous Monday's week", () => {
    const sunday = Date.UTC(2026, 6, 5, 23, 59);
    expect(weekStartUtc(sunday)).toBe(Date.UTC(2026, 5, 29));
  });

  test("nextWeeklyResetUtc is the following Monday", () => {
    expect(nextWeeklyResetUtc(saturday)).toBe(Date.UTC(2026, 6, 6));
  });
});

describe("month boundaries (1st 00:00 UTC)", () => {
  test("monthStartUtc", () => {
    expect(monthStartUtc(Date.UTC(2026, 6, 4, 12))).toBe(Date.UTC(2026, 6, 1));
  });

  test("nextMonthlyResetUtc rolls the year over from December", () => {
    expect(nextMonthlyResetUtc(Date.UTC(2026, 11, 31, 23))).toBe(
      Date.UTC(2027, 0, 1),
    );
  });
});

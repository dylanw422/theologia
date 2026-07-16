import { describe, expect, test } from "vitest";

import {
  effectivePlan,
  FREE_MONTHLY_QUERY_LIMIT,
  PLANS,
  planFromProductKey,
  planMeetsMinimum,
} from "./plans";

describe("effectivePlan", () => {
  test("beta users get at least Ministry access", () => {
    expect(effectivePlan("free", true)).toBe("ministry");
    expect(effectivePlan("scholar", true)).toBe("ministry");
    expect(effectivePlan("ministry", true)).toBe("ministry");
  });

  test("beta never downgrades a higher paid plan", () => {
    expect(effectivePlan("churchTeam", true)).toBe("churchTeam");
  });

  test("non-beta users keep their subscription plan", () => {
    expect(effectivePlan("free", false)).toBe("free");
    expect(effectivePlan("scholar", false)).toBe("scholar");
    expect(effectivePlan("churchTeam", false)).toBe("churchTeam");
  });
});

describe("planFromProductKey", () => {
  test("maps Polar product keys to plans", () => {
    expect(planFromProductKey("scholar")).toBe("scholar");
    expect(planFromProductKey("ministry")).toBe("ministry");
    expect(planFromProductKey("churchTeam")).toBe("churchTeam");
  });

  test("no subscription or unknown key means free", () => {
    expect(planFromProductKey(null)).toBe("free");
    expect(planFromProductKey(undefined)).toBe("free");
    expect(planFromProductKey("something-else")).toBe("free");
  });
});

describe("PLANS", () => {
  test("free runs Sonnet 5 with no dollar budget", () => {
    expect(PLANS.free.model).toBe("claude-sonnet-5");
    expect(PLANS.free.weeklyBudgetMicroUsd).toBeNull();
    expect(FREE_MONTHLY_QUERY_LIMIT).toBe(20);
  });

  test("all paid plans run Sonnet 5 with weekly budgets from PRICING.md", () => {
    expect(PLANS.scholar.model).toBe("claude-sonnet-5");
    expect(PLANS.ministry.model).toBe("claude-sonnet-5");
    expect(PLANS.churchTeam.model).toBe("claude-sonnet-5");
    expect(PLANS.scholar.weeklyBudgetMicroUsd).toBe(1_375_000);
    expect(PLANS.ministry.weeklyBudgetMicroUsd).toBe(2_825_000);
    expect(PLANS.churchTeam.weeklyBudgetMicroUsd).toBe(7_200_000);
  });
});

describe("planMeetsMinimum", () => {
  test("a plan meets its own minimum and every lower one", () => {
    expect(planMeetsMinimum("scholar", "scholar")).toBe(true);
    expect(planMeetsMinimum("scholar", "free")).toBe(true);
  });

  test("a plan does not meet a higher minimum", () => {
    expect(planMeetsMinimum("free", "scholar")).toBe(false);
    expect(planMeetsMinimum("scholar", "ministry")).toBe(false);
  });

  test("churchTeam meets the ministry minimum", () => {
    expect(planMeetsMinimum("churchTeam", "ministry")).toBe(true);
  });
});

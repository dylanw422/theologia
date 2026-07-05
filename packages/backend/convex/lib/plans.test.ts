import { describe, expect, test } from "vitest";

import { FREE_MONTHLY_QUERY_LIMIT, PLANS, planFromProductKey } from "./plans";

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
  test("free runs Haiku with no dollar budget", () => {
    expect(PLANS.free.model).toBe("claude-haiku-4-5");
    expect(PLANS.free.weeklyBudgetMicroUsd).toBeNull();
    expect(FREE_MONTHLY_QUERY_LIMIT).toBe(20);
  });

  test("paid plans run Sonnet 5 with weekly budgets from PRICING.md", () => {
    expect(PLANS.scholar.model).toBe("claude-sonnet-5");
    expect(PLANS.scholar.weeklyBudgetMicroUsd).toBe(1_375_000);
    expect(PLANS.ministry.weeklyBudgetMicroUsd).toBe(2_825_000);
    expect(PLANS.churchTeam.weeklyBudgetMicroUsd).toBe(7_200_000);
  });
});

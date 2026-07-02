// Mock usage data — swapped for real metering in a later slice.
// Usage is metered internally as API cost in dollars against a weekly
// budget (the plan's monthly API budget ÷ 4). Users never see dollars —
// the UI surfaces only the percentage used and when the window resets.

export type PlanId = "free" | "scholar" | "ministry" | "church-team";

export type Plan = {
  id: PlanId;
  label: string;
  weeklyBudgetUsd: number;
};

export const PLANS: Record<PlanId, Plan> = {
  free: { id: "free", label: "Free", weeklyBudgetUsd: 0.2 },
  scholar: { id: "scholar", label: "Scholar", weeklyBudgetUsd: 1.38 },
  ministry: { id: "ministry", label: "Ministry", weeklyBudgetUsd: 2.83 },
  "church-team": {
    id: "church-team",
    label: "Church Team",
    weeklyBudgetUsd: 7.2,
  },
};

export type UsageSnapshot = {
  plan: Plan;
  usedUsd: number;
};

export const MOCK_USAGE: UsageSnapshot = {
  plan: PLANS.scholar,
  usedUsd: 0.9,
};

// Weekly windows reset Monday at 00:00 local time.
export function nextWeeklyReset(from = new Date()): Date {
  const reset = new Date(from);
  reset.setHours(0, 0, 0, 0);
  const daysUntilMonday = (8 - reset.getDay()) % 7 || 7;
  reset.setDate(reset.getDate() + daysUntilMonday);
  return reset;
}

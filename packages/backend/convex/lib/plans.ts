// Canonical plan table. Budgets come from docs/PRICING.md (monthly API
// budget ÷ 4, in micro-USD). Free is query-counted, not dollar-metered.

export type PlanId = "free" | "scholar" | "ministry" | "churchTeam";

export type Plan = {
  id: PlanId;
  label: string;
  /** Anthropic model ID this plan's replies run on. */
  model: string;
  /** Weekly API budget in micro-USD; null for the query-counted free tier. */
  weeklyBudgetMicroUsd: number | null;
};

export const FREE_MONTHLY_QUERY_LIMIT = 20;

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    label: "Free",
    // Same model as paid tiers: the trial is honest — the product free users
    // sample is the product they'd buy. The limit, not the model, is the
    // upgrade lever.
    model: "claude-sonnet-5",
    weeklyBudgetMicroUsd: null,
  },
  scholar: {
    id: "scholar",
    label: "Scholar",
    model: "claude-sonnet-5",
    weeklyBudgetMicroUsd: 1_375_000,
  },
  ministry: {
    id: "ministry",
    label: "Ministry",
    model: "claude-sonnet-5",
    weeklyBudgetMicroUsd: 2_825_000,
  },
  churchTeam: {
    id: "churchTeam",
    label: "Church Team",
    model: "claude-sonnet-5",
    weeklyBudgetMicroUsd: 7_200_000,
  },
};

export function planFromProductKey(
  key: string | null | undefined,
): PlanId {
  switch (key) {
    case "scholar":
    case "ministry":
    case "churchTeam":
      return key;
    default:
      return "free";
  }
}

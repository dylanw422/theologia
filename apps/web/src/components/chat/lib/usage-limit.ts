import { ConvexError } from "convex/values";

import { getMode, modeMinPlanLabel } from "./modes";
import type { ModeId } from "./chat-state";

/** Message for a USAGE_LIMIT ConvexError; null for anything else. */
export function usageLimitMessage(error: unknown): string | null {
  if (!(error instanceof ConvexError)) return null;
  const data = error.data as { code?: string; planId?: string } | undefined;
  if (data?.code !== "USAGE_LIMIT") return null;
  return data.planId === "free"
    ? "You've used all 20 free queries this month. Upgrade for more."
    : "You've reached your weekly usage limit. Upgrade your plan or wait for the reset.";
}

/** Message for a MODE_LOCKED ConvexError; null for anything else. Server-side
 * backstop for the mode picker's own gating (e.g. a stale client, or a
 * direct mutation call bypassing the UI). */
export function modeLockedMessage(error: unknown): string | null {
  if (!(error instanceof ConvexError)) return null;
  const data = error.data as { code?: string; mode?: string } | undefined;
  if (data?.code !== "MODE_LOCKED") return null;
  if (!data.mode) return "This mode requires a higher plan.";
  const mode = getMode(data.mode as ModeId);
  return `${mode.label} requires the ${modeMinPlanLabel(mode.id)} plan.`;
}

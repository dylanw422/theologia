import { ConvexError } from "convex/values";
import { describe, expect, test } from "vitest";

import { modeLockedMessage, usageLimitMessage } from "./usage-limit";

describe("usageLimitMessage", () => {
  test("free-plan limit", () => {
    const err = new ConvexError({ code: "USAGE_LIMIT", planId: "free" });
    expect(usageLimitMessage(err)).toBe(
      "You've used all 20 free queries this month. Upgrade for more.",
    );
  });

  test("paid-plan limit", () => {
    const err = new ConvexError({ code: "USAGE_LIMIT", planId: "scholar" });
    expect(usageLimitMessage(err)).toBe(
      "You've reached your weekly usage limit. Upgrade your plan or wait for the reset.",
    );
  });

  test("other errors return null", () => {
    expect(usageLimitMessage(new Error("boom"))).toBeNull();
    expect(usageLimitMessage(new ConvexError({ code: "OTHER" }))).toBeNull();
    expect(usageLimitMessage(undefined)).toBeNull();
  });
});

describe("modeLockedMessage", () => {
  test("names the mode and the required plan", () => {
    const err = new ConvexError({ code: "MODE_LOCKED", mode: "catechism" });
    expect(modeLockedMessage(err)).toBe(
      "Catechism requires the Ministry plan.",
    );
  });

  test("falls back to a generic message when the mode is missing", () => {
    const err = new ConvexError({ code: "MODE_LOCKED" });
    expect(modeLockedMessage(err)).toBe("This mode requires a higher plan.");
  });

  test("other errors return null", () => {
    expect(modeLockedMessage(new Error("boom"))).toBeNull();
    expect(modeLockedMessage(new ConvexError({ code: "OTHER" }))).toBeNull();
    expect(modeLockedMessage(undefined)).toBeNull();
  });
});

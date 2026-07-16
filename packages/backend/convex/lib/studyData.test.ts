import { describe, expect, test } from "vitest";

import { isModeAllowedForPlan, MODE_MIN_PLAN } from "./studyData";

describe("isModeAllowedForPlan", () => {
  test("free plan only gets Q&A (and its legacy alias)", () => {
    expect(isModeAllowedForPlan("qa", "free")).toBe(true);
    expect(isModeAllowedForPlan("resources", "free")).toBe(true);
    expect(isModeAllowedForPlan("devils-advocate", "free")).toBe(false);
    expect(isModeAllowedForPlan("catechism", "free")).toBe(false);
  });

  test("scholar unlocks Devil's Advocate and Comparison but not deep-study modes", () => {
    expect(isModeAllowedForPlan("devils-advocate", "scholar")).toBe(true);
    expect(isModeAllowedForPlan("comparison", "scholar")).toBe(true);
    expect(isModeAllowedForPlan("debate-prep", "scholar")).toBe(true);
    expect(isModeAllowedForPlan("catechism", "scholar")).toBe(false);
    expect(isModeAllowedForPlan("scripture-study", "scholar")).toBe(false);
  });

  test("ministry and churchTeam unlock every mode", () => {
    for (const mode of Object.keys(MODE_MIN_PLAN) as (keyof typeof MODE_MIN_PLAN)[]) {
      expect(isModeAllowedForPlan(mode, "ministry")).toBe(true);
      expect(isModeAllowedForPlan(mode, "churchTeam")).toBe(true);
    }
  });
});

import { describe, expect, it } from "vitest";

import {
  buildProfileSection,
  buildProfileSummary,
  PROFILE_SUMMARY_MAX_CHARS,
  type SummaryPosition,
} from "./profileSummary";

function pos(overrides: Partial<SummaryPosition> = {}): SummaryPosition {
  return {
    locus: "soteriology",
    topic: "election",
    statement: "Regeneration precedes faith.",
    stance: "affirmed",
    strength: "settled",
    createdAt: 1,
    excluded: false,
    ...overrides,
  };
}

describe("buildProfileSummary", () => {
  it("formats one line per position: locus label, topic, statement, stance, strength", () => {
    expect(buildProfileSummary([pos()])).toBe(
      "- [Soteriology / election] Regeneration precedes faith. (affirmed, settled)",
    );
  });

  it("returns null for empty input and for all-excluded input", () => {
    expect(buildProfileSummary([])).toBeNull();
    expect(buildProfileSummary([pos({ excluded: true })])).toBeNull();
  });

  it("collapses to the latest claim per topic and drops excluded ones", () => {
    const summary = buildProfileSummary([
      pos({ statement: "Old reading.", createdAt: 100 }),
      pos({ statement: "New reading.", createdAt: 200 }),
      pos({ topic: "atonement", statement: "Hidden.", excluded: true }),
    ]);
    expect(summary).toContain("New reading.");
    expect(summary).not.toContain("Old reading.");
    expect(summary).not.toContain("Hidden.");
  });

  it("orders settled → leaning → exploring, newest first within a band", () => {
    const summary = buildProfileSummary([
      pos({ topic: "explore-new", strength: "exploring", createdAt: 500 }),
      pos({ topic: "settled-old", strength: "settled", createdAt: 100 }),
      pos({ topic: "settled-new", strength: "settled", createdAt: 200 }),
      pos({ topic: "leaning-mid", strength: "leaning", createdAt: 400 }),
    ]);
    expect(summary).not.toBeNull();
    const order = ["settled-new", "settled-old", "leaning-mid", "explore-new"].map(
      (topic) => summary!.indexOf(topic),
    );
    expect(order.every((i) => i >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it("caps at PROFILE_SUMMARY_MAX_CHARS on whole-line boundaries, strongest surviving", () => {
    // Each line ≈ 1192 chars: two fit under 2400, the third (exploring) falls off.
    const long = "x".repeat(1150);
    const summary = buildProfileSummary([
      pos({ topic: "t-a", statement: long, createdAt: 3 }),
      pos({ topic: "t-b", statement: long, createdAt: 2 }),
      pos({ topic: "t-c", statement: long, strength: "exploring", createdAt: 1 }),
    ]);
    expect(summary).not.toBeNull();
    expect(summary!.length).toBeLessThanOrEqual(PROFILE_SUMMARY_MAX_CHARS);
    expect(summary).toContain("t-a");
    expect(summary).toContain("t-b");
    expect(summary).not.toContain("t-c");
  });
});

describe("buildProfileSection", () => {
  it("wraps the summary with header, usage rules, and the followup guidance", () => {
    const section = buildProfileSection("- [Soteriology / election] X (affirmed, settled)");
    expect(section).toContain("## The user's theological profile");
    expect(section).toContain("- [Soteriology / election] X (affirmed, settled)");
    expect(section).toContain("<followups>");
    expect(section).toContain("Build on these positions");
    // Phase 2 house rule applies to prompt copy too.
    expect(section).not.toMatch(/contradict/i);
  });
});

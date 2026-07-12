import { describe, expect, it } from "vitest";

import { developmentLabel, topicHistories } from "./development";

describe("topicHistories", () => {
  it("groups by topic preserving input order", () => {
    const grouped = topicHistories([
      { topic: "election", createdAt: 1 },
      { topic: "baptism", createdAt: 2 },
      { topic: "election", createdAt: 3 },
    ]);
    expect(grouped.get("election")?.map((e) => e.createdAt)).toEqual([1, 3]);
    expect(grouped.get("baptism")?.map((e) => e.createdAt)).toEqual([2]);
  });

  it("returns an empty map for empty history", () => {
    expect(topicHistories([]).size).toBe(0);
  });
});

describe("developmentLabel", () => {
  it("labels a same-year run with bare months", () => {
    expect(
      developmentLabel([
        { createdAt: Date.UTC(2026, 2, 15) },
        { createdAt: Date.UTC(2026, 4, 15) },
        { createdAt: Date.UTC(2026, 6, 15) },
      ]),
    ).toBe("3 positions, Mar → Jul");
  });

  it("includes years when the run crosses a year boundary", () => {
    expect(
      developmentLabel([
        { createdAt: Date.UTC(2025, 10, 15) },
        { createdAt: Date.UTC(2026, 6, 15) },
      ]),
    ).toBe("2 positions, Nov 2025 → Jul 2026");
  });
});

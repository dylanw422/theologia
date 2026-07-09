import { describe, expect, it } from "vitest";

import { getLocusLabel, latestPerTopic, LOCI, LOCUS_IDS } from "./profile";

describe("LOCI", () => {
  it("lists the eight classical loci in canonical order", () => {
    expect(LOCUS_IDS).toEqual([
      "scripture-revelation",
      "theology-proper",
      "christology",
      "pneumatology",
      "anthropology-sin",
      "soteriology",
      "ecclesiology-sacraments",
      "eschatology",
    ]);
    expect(LOCI).toHaveLength(8);
  });

  it("resolves labels and returns undefined for unknown ids", () => {
    expect(getLocusLabel("soteriology")).toBe("Soteriology");
    expect(getLocusLabel("nope")).toBeUndefined();
  });
});

describe("latestPerTopic", () => {
  const p = (topic: string, createdAt: number, excluded = false) => ({
    topic,
    createdAt,
    excluded,
  });

  it("keeps only the newest position per topic, newest-first overall", () => {
    const result = latestPerTopic([
      p("election", 100),
      p("election", 300),
      p("baptism", 200),
    ]);
    expect(result).toEqual([p("election", 300), p("baptism", 200)]);
  });

  it("drops excluded positions entirely, even the newest", () => {
    const result = latestPerTopic([p("election", 100), p("election", 300, true)]);
    expect(result).toEqual([p("election", 100)]);
  });

  it("returns [] for empty input", () => {
    expect(latestPerTopic([])).toEqual([]);
  });
});

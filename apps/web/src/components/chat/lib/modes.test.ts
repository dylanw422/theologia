import { describe, expect, it } from "vitest";

import {
  COLLECTIONS,
  DOCUMENTS,
  MODES,
  PURPOSES,
  describeSetup,
  getMode,
  isSetupValid,
} from "./modes";

describe("MODES", () => {
  it("defines the eight modes with qa first and unique ids", () => {
    expect(MODES).toHaveLength(8);
    expect(MODES[0].id).toBe("qa");
    expect(new Set(MODES.map((m) => m.id)).size).toBe(8);
  });

  it("gives every mode three sample prompts and full copy", () => {
    for (const mode of MODES) {
      expect(mode.samplePrompts).toHaveLength(3);
      expect(mode.label.length).toBeGreaterThan(0);
      expect(mode.heading.em.length).toBeGreaterThan(0);
      expect(mode.lede.length).toBeGreaterThan(0);
      expect(mode.placeholder.length).toBeGreaterThan(0);
    }
  });

  it("getMode returns the matching definition", () => {
    expect(getMode("debate-prep").setup).toBe("versus");
  });
});

describe("reference lists", () => {
  it("has the 12 GOAL.md confessional documents", () => {
    expect(DOCUMENTS).toHaveLength(12);
    expect(DOCUMENTS.map((d) => d.id)).toContain("heidelberg");
  });

  it("has 6 library collections and 4 purposes", () => {
    expect(COLLECTIONS).toHaveLength(6);
    expect(PURPOSES).toHaveLength(4);
  });
});

describe("isSetupValid", () => {
  it("tradition modes need a framework", () => {
    expect(isSetupValid("qa", {})).toBe(false);
    expect(isSetupValid("qa", { framework: "reformed" })).toBe(true);
    expect(isSetupValid("scripture-study", { framework: "lutheran" })).toBe(
      true,
    );
  });

  it("versus modes need two different traditions", () => {
    expect(isSetupValid("devils-advocate", { framework: "reformed" })).toBe(
      false,
    );
    expect(
      isSetupValid("devils-advocate", {
        framework: "reformed",
        opposing: "reformed",
      }),
    ).toBe(false);
    expect(
      isSetupValid("debate-prep", {
        framework: "reformed",
        opposing: "arminian-wesleyan",
      }),
    ).toBe(true);
  });

  it("comparison needs 2-4 unique traditions", () => {
    expect(isSetupValid("comparison", { traditions: ["reformed"] })).toBe(
      false,
    );
    expect(
      isSetupValid("comparison", { traditions: ["reformed", "reformed"] }),
    ).toBe(false);
    expect(
      isSetupValid("comparison", { traditions: ["reformed", "lutheran"] }),
    ).toBe(true);
    expect(
      isSetupValid("comparison", {
        traditions: [
          "reformed",
          "lutheran",
          "baptist",
          "roman-catholic",
          "eastern-orthodox",
        ],
      }),
    ).toBe(false);
  });

  it("catechism needs a document; resources needs framework + purpose; library is always valid", () => {
    expect(isSetupValid("catechism", {})).toBe(false);
    expect(isSetupValid("catechism", { document: "heidelberg" })).toBe(true);
    expect(isSetupValid("resources", { framework: "reformed" })).toBe(false);
    expect(
      isSetupValid("resources", {
        framework: "reformed",
        purpose: "personal-study",
      }),
    ).toBe(true);
    expect(isSetupValid("library", {})).toBe(true);
    expect(isSetupValid("library", { collection: "ante-nicene" })).toBe(true);
  });
});

describe("describeSetup", () => {
  it("labels tradition (+sub) setups", () => {
    expect(
      describeSetup({
        mode: "qa",
        framework: "reformed",
        subTradition: "reformed-baptist",
      }),
    ).toBe("Reformed · Reformed Baptist");
    expect(describeSetup({ mode: "qa", framework: "lutheran" })).toBe(
      "Lutheran",
    );
  });

  it("labels versus setups", () => {
    expect(
      describeSetup({
        mode: "devils-advocate",
        framework: "reformed",
        opposing: "arminian-wesleyan",
      }),
    ).toBe("Reformed vs Arminian");
  });

  it("labels comparison, document, collection, and purpose setups", () => {
    expect(
      describeSetup({
        mode: "comparison",
        traditions: ["reformed", "arminian-wesleyan", "roman-catholic"],
      }),
    ).toBe("Reformed · Arminian · Roman Catholic");
    expect(describeSetup({ mode: "catechism", document: "heidelberg" })).toBe(
      "Heidelberg Catechism",
    );
    expect(
      describeSetup({ mode: "library", collection: "ante-nicene" }),
    ).toContain("Ante-Nicene");
    expect(describeSetup({ mode: "library" })).toBe("");
    expect(
      describeSetup({
        mode: "resources",
        framework: "reformed",
        purpose: "sermon-prep",
      }),
    ).toBe("Reformed · Sermon prep");
  });
});

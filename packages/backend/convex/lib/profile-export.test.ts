import { describe, expect, it } from "vitest";

import { buildProfileMarkdown, type ExportPosition } from "./profile-export";

const at = Date.UTC(2026, 2, 14); // 2026-03-14

const position = (over: Partial<ExportPosition> = {}): ExportPosition => ({
  locus: "soteriology",
  topic: "election",
  statement: "Regeneration precedes faith.",
  stance: "affirmed",
  strength: "settled",
  frameworkLabel: "Reformed",
  createdAt: at,
  ...over,
});

describe("buildProfileMarkdown", () => {
  it("renders loci in canonical order with statements and apparatus", () => {
    const md = buildProfileMarkdown(
      [
        position(),
        position({
          locus: "christology",
          topic: "two-natures",
          statement: "Christ is one person in two natures.",
        }),
      ],
      at,
    );
    expect(md).toContain("# Your Theology");
    expect(md).toContain("2026-03-14");
    // Christology precedes Soteriology in the canonical order.
    expect(md.indexOf("## Christology")).toBeLessThan(md.indexOf("## Soteriology"));
    expect(md).toContain("**Regeneration precedes faith.**");
    expect(md).toContain("affirmed · settled · Reformed · 2026-03-14");
  });

  it("omits loci with no positions and handles a missing framework", () => {
    const md = buildProfileMarkdown([position({ frameworkLabel: undefined })], at);
    expect(md).not.toContain("## Eschatology");
    expect(md).toContain("affirmed · settled · 2026-03-14");
  });

  it("renders an honest empty confession", () => {
    const md = buildProfileMarkdown([], at);
    expect(md).toContain("# Your Theology");
    expect(md).toContain("No positions recorded yet");
  });
});

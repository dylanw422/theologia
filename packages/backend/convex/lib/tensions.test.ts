import { describe, expect, it } from "vitest";

import { LOCUS_IDS, type LocusId } from "./profile";
import {
  ADJACENT_LOCI,
  buildStudyPrompt,
  buildTensionSystemPrompt,
  buildTensionUserPrompt,
  lociToConsider,
  MAX_OPEN_SURFACED,
  MAX_TENSIONS_PER_PASS,
  pairKey,
  parseTensionResponse,
  selectOpenTensions,
  type JudgePosition,
} from "./tensions";

describe("ADJACENT_LOCI", () => {
  it("covers all eight loci and is symmetric", () => {
    expect(Object.keys(ADJACENT_LOCI).sort()).toEqual([...LOCUS_IDS].sort());
    for (const locus of LOCUS_IDS) {
      for (const neighbor of ADJACENT_LOCI[locus]) {
        expect(ADJACENT_LOCI[neighbor]).toContain(locus);
        expect(neighbor).not.toBe(locus);
      }
    }
  });
});

describe("lociToConsider", () => {
  it("includes the input loci plus adjacents, deduped, in canonical order", () => {
    const out = lociToConsider(["soteriology"]);
    expect(out).toContain("soteriology");
    expect(out).toContain("anthropology-sin");
    expect(out).toContain("theology-proper");
    expect(new Set(out).size).toBe(out.length);
    // Canonical order: theology-proper (index 1) precedes soteriology (index 5).
    expect(out.indexOf("theology-proper")).toBeLessThan(out.indexOf("soteriology"));
  });

  it("returns [] for []", () => {
    expect(lociToConsider([])).toEqual([]);
  });
});

describe("pairKey", () => {
  it("is order-independent and distinguishes pairs", () => {
    expect(pairKey("x1", "x2")).toBe(pairKey("x2", "x1"));
    expect(pairKey("x1", "x2")).not.toBe(pairKey("x1", "x3"));
  });
});

const position = (over: Partial<JudgePosition> = {}): JudgePosition => ({
  statement: "Regeneration precedes faith.",
  locus: "soteriology" as LocusId,
  stance: "affirmed",
  topic: "election",
  ...over,
});

describe("prompts", () => {
  it("system prompt carries abstention bias, the JSON contract, and the banned word rule", () => {
    const system = buildTensionSystemPrompt();
    expect(system).toContain('"tensions"');
    expect(system).toContain("return empty");
    expect(system.toLowerCase()).toContain('never use the word "contradiction"');
    expect(system).toContain("salience");
  });

  it("user prompt numbers positions, resolves the framework label, lists covered pairs", () => {
    const prompt = buildTensionUserPrompt(
      [position(), position({ statement: "Grace is resistible.", topic: "grace" })],
      [[0, 1]],
      "reformed",
    );
    expect(prompt).toContain("[0]");
    expect(prompt).toContain("[1]");
    expect(prompt).toContain("Regeneration precedes faith.");
    expect(prompt).toContain("Reformed");
    expect(prompt).toContain("(0, 1)");
  });

  it("omits the covered-pairs block when there are none", () => {
    const prompt = buildTensionUserPrompt([position()], [], undefined);
    expect(prompt).not.toContain("Already reviewed");
    expect(prompt).toContain("not specified");
  });
});

describe("parseTensionResponse", () => {
  const valid = {
    a: 0,
    b: 1,
    description: "One position grounds assurance in decree, the other in perseverance.",
    historicalNote: "The Synod of Dort held both by distinguishing ground from evidence.",
    salience: 2,
  };
  const wrap = (tensions: unknown[]) => JSON.stringify({ tensions });

  it("parses a valid payload", () => {
    expect(parseTensionResponse(wrap([valid]), 2, [])).toEqual([valid]);
  });

  it("tolerates a markdown code fence", () => {
    const raw = "```json\n" + wrap([valid]) + "\n```";
    expect(parseTensionResponse(raw, 2, [])).toEqual([valid]);
  });

  it("returns [] on malformed JSON or wrong shape", () => {
    expect(parseTensionResponse("not json", 2, [])).toEqual([]);
    expect(parseTensionResponse('{"tensions": "nope"}', 2, [])).toEqual([]);
    expect(parseTensionResponse('{"other": []}', 2, [])).toEqual([]);
  });

  it("drops invalid items but keeps valid ones", () => {
    const out = parseTensionResponse(
      wrap([
        valid, // pair (0,1)
        // Each invalid case gets its own pair so none is shadowed by the
        // in-payload dedup, which runs before field validation.
        { ...valid, a: 11, b: 2 }, // out of range
        { ...valid, a: 2, b: 2 }, // self-pair
        { ...valid, a: "0", b: 3 }, // non-number index
        { ...valid, a: 2, b: 3, salience: 4 }, // salience out of bounds
        { ...valid, a: 2, b: 4, salience: 1.5 }, // non-integer salience
        { ...valid, a: 3, b: 4, description: "" },
        { ...valid, a: 3, b: 5, description: "x".repeat(700) },
        "not an object",
      ]),
      11,
      [],
    );
    expect(out).toEqual([valid]);
  });

  it("drops items whose text uses any form of the banned word", () => {
    const out = parseTensionResponse(
      wrap([
        { ...valid, description: "These two claims contradict each other." },
        { ...valid, historicalNote: "A classic contradiction in the tradition." },
      ]),
      2,
      [],
    );
    expect(out).toEqual([]);
  });

  it("normalizes a > b, skips covered pairs and in-payload duplicates", () => {
    const out = parseTensionResponse(
      wrap([
        { ...valid, a: 1, b: 0 }, // normalized to (0,1)
        { ...valid, a: 0, b: 1 }, // duplicate of the first
        { ...valid, a: 2, b: 3 }, // covered
      ]),
      4,
      [[2, 3]],
    );
    expect(out).toEqual([valid]);
  });

  it("treats a missing historicalNote and an empty one the same", () => {
    const out = parseTensionResponse(
      wrap([{ ...valid, historicalNote: "  " }]),
      2,
      [],
    );
    expect(out).toEqual([{ ...valid, historicalNote: undefined }]);
  });

  it("caps items per pass", () => {
    const many = Array.from({ length: 10 }, (_, i) => ({
      ...valid,
      a: 0,
      b: i + 1,
    }));
    const out = parseTensionResponse(wrap(many), 11, []);
    expect(out).toHaveLength(MAX_TENSIONS_PER_PASS);
  });
});

describe("selectOpenTensions", () => {
  it("sorts by salience desc then newest, and caps at MAX_OPEN_SURFACED", () => {
    const items = [
      { salience: 1, createdAt: 500 },
      { salience: 3, createdAt: 100 },
      { salience: 2, createdAt: 300 },
      { salience: 2, createdAt: 400 },
      { salience: 1, createdAt: 900 },
      { salience: 1, createdAt: 700 },
      { salience: 1, createdAt: 800 },
    ];
    const out = selectOpenTensions(items);
    expect(out).toHaveLength(MAX_OPEN_SURFACED);
    expect(out[0]).toEqual({ salience: 3, createdAt: 100 });
    expect(out[1]).toEqual({ salience: 2, createdAt: 400 });
    expect(out[2]).toEqual({ salience: 2, createdAt: 300 });
    expect(out[3]).toEqual({ salience: 1, createdAt: 900 });
  });
});

describe("buildStudyPrompt", () => {
  it("quotes both statements and stays in the neutral register", () => {
    const prompt = buildStudyPrompt(
      "Regeneration precedes faith.",
      "Grace is resistible.",
    );
    expect(prompt).toContain("Regeneration precedes faith.");
    expect(prompt).toContain("Grace is resistible.");
    expect(prompt.toLowerCase()).not.toContain("contradict");
  });
});

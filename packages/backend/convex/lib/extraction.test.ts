import { describe, expect, it } from "vitest";

import {
  buildExtractionPrompt,
  buildTranscript,
  MAX_CLAIMS_PER_PASS,
  normalizeTopic,
  parseExtractionResponse,
} from "./extraction";

describe("buildExtractionPrompt", () => {
  it("states the hard rule and the strict JSON contract", () => {
    const prompt = buildExtractionPrompt("qa", "reformed");
    expect(prompt).toContain("in their own voice");
    expect(prompt).toContain('"claims"');
    expect(prompt).toContain("extract nothing");
    // All eight locus ids are offered as the closed vocabulary.
    expect(prompt).toContain("soteriology");
    expect(prompt).toContain("scripture-revelation");
    // Framework context is resolved to its label.
    expect(prompt).toContain("Reformed");
  });

  it("warns about adversarial transcripts in devils-advocate and debate-prep", () => {
    for (const mode of ["devils-advocate", "debate-prep"] as const) {
      expect(buildExtractionPrompt(mode, "reformed")).toContain("opposing");
    }
    expect(buildExtractionPrompt("qa", "reformed")).not.toContain("ADVERSARIAL");
  });
});

describe("parseExtractionResponse", () => {
  const valid = {
    locus: "soteriology",
    topic: "election",
    statement: "Regeneration precedes faith.",
    stance: "affirmed",
    strength: "leaning",
  };

  it("parses a valid claims payload", () => {
    const out = parseExtractionResponse(JSON.stringify({ claims: [valid] }));
    expect(out).toEqual([valid]);
  });

  it("tolerates a markdown code fence around the JSON", () => {
    const raw = "```json\n" + JSON.stringify({ claims: [valid] }) + "\n```";
    expect(parseExtractionResponse(raw)).toEqual([valid]);
  });

  it("returns [] on malformed JSON or wrong shape", () => {
    expect(parseExtractionResponse("not json")).toEqual([]);
    expect(parseExtractionResponse('{"claims": "nope"}')).toEqual([]);
    expect(parseExtractionResponse('{"other": []}')).toEqual([]);
  });

  it("drops individual invalid claims but keeps valid ones", () => {
    const out = parseExtractionResponse(
      JSON.stringify({
        claims: [
          valid,
          { ...valid, locus: "not-a-locus" },
          { ...valid, stance: "maybe" },
          { ...valid, strength: "rock-solid" },
          { ...valid, statement: "" },
          { ...valid, statement: "x".repeat(400) },
          { ...valid, topic: "" },
          "not an object",
        ],
      }),
    );
    expect(out).toEqual([valid]);
  });

  it("normalizes topics into slugs", () => {
    const out = parseExtractionResponse(
      JSON.stringify({ claims: [{ ...valid, topic: "Baptismal Efficacy!" }] }),
    );
    expect(out[0].topic).toBe("baptismal-efficacy");
  });

  it("caps the number of claims per pass", () => {
    const many = Array.from({ length: 25 }, (_, i) => ({
      ...valid,
      topic: `topic-${i}`,
    }));
    const out = parseExtractionResponse(JSON.stringify({ claims: many }));
    expect(out).toHaveLength(MAX_CLAIMS_PER_PASS);
  });
});

describe("normalizeTopic", () => {
  it("lowercases, hyphenates, and strips punctuation", () => {
    expect(normalizeTopic("  The Extent of the Atonement ")).toBe(
      "the-extent-of-the-atonement",
    );
    expect(normalizeTopic("sola_scriptura?")).toBe("sola-scriptura");
  });
});

describe("buildTranscript", () => {
  it("labels roles and skips empty messages", () => {
    const t = buildTranscript([
      { role: "user", text: "Does baptism save?" },
      { role: "assistant", text: "The tradition answers..." },
      { role: "user", text: "" },
      { role: "user" },
    ]);
    expect(t).toBe("USER: Does baptism save?\n\nASSISTANT: The tradition answers...");
  });

  it("truncates very long individual messages", () => {
    const t = buildTranscript([{ role: "user", text: "y".repeat(10_000) }]);
    expect(t.length).toBeLessThan(6_000);
    expect(t).toContain("[truncated]");
  });
});

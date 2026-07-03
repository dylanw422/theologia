import { describe, expect, it } from "vitest";

import { parseBlocks } from "./parse-blocks";

describe("parseBlocks — prose", () => {
  it("plain text becomes prose blocks split on blank lines", () => {
    const { blocks, actions, pending } = parseBlocks(
      "First paragraph.\n\nSecond paragraph.",
    );
    expect(blocks).toEqual([
      { type: "prose", text: "First paragraph." },
      { type: "prose", text: "Second paragraph." },
    ]);
    expect(actions).toEqual([]);
    expect(pending).toBe(false);
  });

  it("empty text yields nothing", () => {
    expect(parseBlocks("")).toEqual({ blocks: [], actions: [], pending: false });
  });
});

describe("parseBlocks — structured tags", () => {
  it("scripture", () => {
    const { blocks } = parseBlocks(
      '<scripture ref="Romans 9:19">You will say to me then…</scripture>',
    );
    expect(blocks).toEqual([
      {
        type: "scripture",
        reference: "Romans 9:19",
        text: "You will say to me then…",
      },
    ]);
  });

  it("history", () => {
    const { blocks } = parseBlocks(
      '<history heading="An old debate">Augustine against Pelagius.</history>',
    );
    expect(blocks).toEqual([
      { type: "history", heading: "An old debate", text: "Augustine against Pelagius." },
    ]);
  });

  it("lexicon with self-closing entries", () => {
    const { blocks } = parseBlocks(
      '<lexicon><entry term="ἐξουσία" translit="exousia" gloss="right, authority" /><entry term="σκεῦος" translit="skeuos" gloss="vessel" /></lexicon>',
    );
    expect(blocks).toEqual([
      {
        type: "lexicon",
        entries: [
          { term: "ἐξουσία", translit: "exousia", gloss: "right, authority" },
          { term: "σκεῦος", translit: "skeuos", gloss: "vessel" },
        ],
      },
    ]);
  });

  it("comparison columns with nested fields", () => {
    const { blocks } = parseBlocks(
      '<comparison><column tradition="Reformed"><position>Monergism.</position><texts>Rom 9:16</texts><theologians>Calvin</theologians></column><column tradition="Lutheran"><position>Means of grace.</position><texts>Rom 10:17</texts><theologians>Chemnitz</theologians></column></comparison>',
    );
    expect(blocks).toEqual([
      {
        type: "comparison",
        columns: [
          { tradition: "Reformed", position: "Monergism.", texts: "Rom 9:16", theologians: "Calvin" },
          { tradition: "Lutheran", position: "Means of grace.", texts: "Rom 10:17", theologians: "Chemnitz" },
        ],
      },
    ]);
  });

  it("points with kind and optional weight", () => {
    const { blocks } = parseBlocks(
      '<points kind="objection"><point title="Corporate vocation" weight="Strongest">Body one.</point><point title="Second">Body two.</point></points>',
    );
    expect(blocks).toEqual([
      {
        type: "points",
        kind: "objection",
        items: [
          { title: "Corporate vocation", body: "Body one.", weight: "Strongest" },
          { title: "Second", body: "Body two." },
        ],
      },
    ]);
  });

  it("points defaults invalid kind to objection", () => {
    const { blocks } = parseBlocks(
      '<points kind="rebuttal"><point title="T">B.</point></points>',
    );
    expect(blocks[0]).toMatchObject({ type: "points", kind: "objection" });
  });

  it("resources with tier validation", () => {
    const { blocks } = parseBlocks(
      '<resources><item title="Institutes" author="John Calvin" tier="scholarly">The fountainhead.</item><item title="Bad Tier" author="A" tier="expert">Note.</item></resources>',
    );
    expect(blocks).toEqual([
      {
        type: "resources",
        items: [
          { title: "Institutes", author: "John Calvin", tier: "scholarly", note: "The fountainhead." },
          { title: "Bad Tier", author: "A", tier: "introductory", note: "Note." },
        ],
      },
    ]);
  });

  it("source", () => {
    const { blocks } = parseBlocks(
      '<source work="Against Heresies" author="Irenaeus" citation="IV.37">Excerpt text.</source>',
    );
    expect(blocks).toEqual([
      { type: "source", work: "Against Heresies", author: "Irenaeus", citation: "IV.37", excerpt: "Excerpt text." },
    ]);
  });

  it("article with proofs split on semicolons", () => {
    const { blocks } = parseBlocks(
      '<article source="Westminster Confession" label="III.1" proofs="Eph 1:11; Rom 11:33">God ordains.</article>',
    );
    expect(blocks).toEqual([
      {
        type: "article",
        source: "Westminster Confession",
        label: "III.1",
        body: "God ordains.",
        proofs: ["Eph 1:11", "Rom 11:33"],
      },
    ]);
  });

  it("article without proofs omits the field", () => {
    const { blocks } = parseBlocks(
      '<article source="S" label="L">Body.</article>',
    );
    expect(blocks[0]).toEqual({ type: "article", source: "S", label: "L", body: "Body." });
  });

  it("prose interleaves around tags", () => {
    const { blocks } = parseBlocks(
      'Before.\n\n<scripture ref="John 1:1">In the beginning was the Word.</scripture>\n\nAfter.',
    );
    expect(blocks.map((b) => b.type)).toEqual(["prose", "scripture", "prose"]);
  });

  it("unescapes XML entities in attributes and bodies", () => {
    const { blocks } = parseBlocks(
      '<history heading="Faith &amp; works">Law &lt; Gospel &amp; grace.</history>',
    );
    expect(blocks).toEqual([
      { type: "history", heading: "Faith & works", text: "Law < Gospel & grace." },
    ]);
  });
});

describe("parseBlocks — followups", () => {
  it("maps q tags to actions with label and prefill", () => {
    const { blocks, actions } = parseBlocks(
      'Answer.\n\n<followups><q label="How has my tradition read this?">How has my tradition historically read this passage?</q><q label="Show the Greek">Walk me through the Greek of this passage.</q></followups>',
    );
    expect(blocks).toEqual([{ type: "prose", text: "Answer." }]);
    expect(actions).toEqual([
      {
        id: "followup-0",
        label: "How has my tradition read this?",
        prefill: "How has my tradition historically read this passage?",
        next: "",
      },
      {
        id: "followup-1",
        label: "Show the Greek",
        prefill: "Walk me through the Greek of this passage.",
        next: "",
      },
    ]);
  });

  it("a q with an empty body falls back to the label as prefill", () => {
    const { actions } = parseBlocks('<followups><q label="Quiz me"></q></followups>');
    expect(actions).toEqual([
      { id: "followup-0", label: "Quiz me", prefill: "Quiz me", next: "" },
    ]);
  });
});

describe("parseBlocks — streaming partials", () => {
  it("withholds a trailing unclosed tag and reports pending", () => {
    const { blocks, pending } = parseBlocks(
      'Intro prose.\n\n<points kind="objection"><point title="First">Half of the bo',
      { partial: true },
    );
    expect(blocks).toEqual([
      { type: "prose", text: "Intro prose.", streaming: true },
    ]);
    expect(pending).toBe(true);
  });

  it("withholds a partially typed opening tag", () => {
    const { blocks, pending } = parseBlocks("Prose so far <scrip", {
      partial: true,
    });
    expect(blocks).toEqual([
      { type: "prose", text: "Prose so far", streaming: true },
    ]);
    expect(pending).toBe(true);
  });

  it("streams trailing prose live", () => {
    const { blocks, pending } = parseBlocks("Streaming prose still arrivi", {
      partial: true,
    });
    expect(blocks).toEqual([
      { type: "prose", text: "Streaming prose still arrivi", streaming: true },
    ]);
    expect(pending).toBe(false);
  });

  it("emits a partial scripture block once its open tag completes", () => {
    const { blocks, pending } = parseBlocks(
      '<scripture ref="John 1:1">In the beginning was the W',
      { partial: true },
    );
    expect(blocks).toEqual([
      {
        type: "scripture",
        reference: "John 1:1",
        text: "In the beginning was the W",
        streaming: true,
      },
    ]);
    expect(pending).toBe(true);
  });

  it("a partial body strips a half-typed closing tag", () => {
    const { blocks } = parseBlocks(
      '<source work="Confessions" author="Augustine" citation="I.1">Our heart is restless</sou',
      { partial: true },
    );
    expect(blocks).toEqual([
      {
        type: "source",
        work: "Confessions",
        author: "Augustine",
        citation: "I.1",
        excerpt: "Our heart is restless",
        streaming: true,
      },
    ]);
  });

  it("a partial article carries its proofs from the open tag", () => {
    const { blocks } = parseBlocks(
      '<article source="Westminster Confession" label="III.1" proofs="Eph 1:11; Rom 11:33">God orda',
      { partial: true },
    );
    expect(blocks).toEqual([
      {
        type: "article",
        source: "Westminster Confession",
        label: "III.1",
        body: "God orda",
        proofs: ["Eph 1:11", "Rom 11:33"],
        streaming: true,
      },
    ]);
  });

  it("an unclosed body tag missing its required attribute stays withheld", () => {
    const { blocks, pending } = parseBlocks("Intro.\n\n<scripture>In the begi", {
      partial: true,
    });
    expect(blocks).toEqual([{ type: "prose", text: "Intro.", streaming: true }]);
    expect(pending).toBe(true);
  });

  it("a partial body tag with an empty body still renders its shell", () => {
    const { blocks } = parseBlocks('<history heading="An old debate">', {
      partial: true,
    });
    expect(blocks).toEqual([
      { type: "history", heading: "An old debate", text: "", streaming: true },
    ]);
  });

  it("marks the last block streaming in partial mode only", () => {
    const partial = parseBlocks("First done.\n\nSecond arrivi", { partial: true });
    expect(partial.blocks).toEqual([
      { type: "prose", text: "First done." },
      { type: "prose", text: "Second arrivi", streaming: true },
    ]);

    const final = parseBlocks("First done.\n\nSecond done.");
    expect(final.blocks.every((b) => b.streaming === undefined)).toBe(true);
  });

  it("completed tags parse even in partial mode", () => {
    const { blocks } = parseBlocks(
      '<scripture ref="John 1:1">In the beginning.</scripture>\n\nMore pro',
      { partial: true },
    );
    expect(blocks.map((b) => b.type)).toEqual(["scripture", "prose"]);
  });
});

describe("parseBlocks — malformed input degrades to prose", () => {
  it("an unclosed tag in final text becomes prose", () => {
    const { blocks, pending } = parseBlocks(
      '<scripture ref="John 1:1">Never closed.',
    );
    expect(blocks).toEqual([
      { type: "prose", text: '<scripture ref="John 1:1">Never closed.' },
    ]);
    expect(pending).toBe(false);
  });

  it("a structured tag with missing required parts becomes prose", () => {
    const { blocks } = parseBlocks("<scripture>No ref attribute.</scripture>");
    expect(blocks).toEqual([
      { type: "prose", text: "<scripture>No ref attribute.</scripture>" },
    ]);
  });

  it("unknown tags flow through as prose", () => {
    const { blocks } = parseBlocks("<sidebar>Not a real tag.</sidebar>");
    expect(blocks).toEqual([
      { type: "prose", text: "<sidebar>Not a real tag.</sidebar>" },
    ]);
  });

  it("an empty structured tag body yields nothing", () => {
    const { blocks } = parseBlocks('<lexicon></lexicon>');
    expect(blocks).toEqual([]);
  });
});

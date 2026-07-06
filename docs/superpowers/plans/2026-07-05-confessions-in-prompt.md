# Confessions in the Prompt + Patristics Guardrail — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Inject the full public-domain text of the user-selected confessional document into the Catechism-mode system prompt, add an anti-fabrication guardrail for patristic sources everywhere, and attempt prompt caching on the (now large) system prompt.

**Architecture:** Twelve static TypeScript string modules under `packages/backend/convex/lib/confessions/`, exposed via `getDocumentText(id)`. `buildSystemPrompt` appends the selected document in catechism mode only. Guardrail language lands in the shared PERSONA and library mode section. Caching is attempted in `streamReply` via AI SDK Anthropic provider options, with a documented fallback.

**Tech Stack:** Convex (backend functions), TypeScript, Vitest, AI SDK v6 + `@ai-sdk/anthropic`, `@convex-dev/agent`.

**Spec:** `docs/superpowers/specs/2026-07-05-confessions-in-prompt-design.md`

## Global Constraints

- All document texts must come from **public-domain editions**; record the edition in a `Text:` note at the top of each document string.
- Texts are **plain text**: strip all HTML, markdown syntax, footnote markers, and page numbers. Preserve the document's own numbering exactly (`Q. 1.`, `Chapter III`, `Canon 4`, `Article 1`).
- Every document module exports `export const TEXT = \`...\`;` as a template literal. Before embedding fetched text, replace any backtick with `` \` `` and any `${` with `\${` (search first; most of these texts contain neither).
- Tests run from the backend package: `(cd packages/backend && bunx vitest run <file>)`.
- Do not modify `DOCUMENTS` in `studyData.ts` — the 12 ids there are the contract.
- Commit after every task.
- Fetched sources are candidates, not gospel: after fetching, eyeball the text for completeness (opening and closing sections present, numbering continuous). If a URL is dead or the text is truncated, use the listed fallback source.

## File Structure

```
packages/backend/convex/lib/confessions/
  index.ts                 — id → text map, getDocumentText()
  confessions.test.ts      — corpus sanity tests
  ecumenical-creeds.ts     — Task 1
  chalcedon.ts             — Task 1
  dordrecht.ts             — Task 1
  heidelberg.ts            — Task 2
  belgic.ts                — Task 2
  dort.ts                  — Task 2
  westminster.ts           — Task 3
  london-1689.ts           — Task 4
  augsburg.ts              — Task 5
  luthers-catechisms.ts    — Task 5
  trent.ts                 — Task 6
  baltimore.ts             — Task 6
packages/backend/convex/lib/prompts.ts        — Tasks 7, 8
packages/backend/convex/lib/prompts.test.ts   — Tasks 7, 8
packages/backend/convex/chat.ts               — Task 9
docs/NEXT_STEPS.md                            — Task 9
```

---

### Task 1: Confessions module scaffold + three small documents

**Files:**
- Create: `packages/backend/convex/lib/confessions/ecumenical-creeds.ts`
- Create: `packages/backend/convex/lib/confessions/chalcedon.ts`
- Create: `packages/backend/convex/lib/confessions/dordrecht.ts`
- Create: `packages/backend/convex/lib/confessions/index.ts`
- Test: `packages/backend/convex/lib/confessions/confessions.test.ts`

**Interfaces:**
- Produces: `getDocumentText(id: string): string | undefined` exported from `packages/backend/convex/lib/confessions/index.ts`. Ids match `DOCUMENTS` ids in `studyData.ts` (`"ecumenical-creeds"`, `"chalcedon"`, `"dordrecht"`, and later tasks' ids). Every later task depends on this exact signature.
- Produces: the `EXPECTED` marker-table pattern in `confessions.test.ts` that Tasks 2–6 extend.

- [ ] **Step 1: Write the failing test**

Create `packages/backend/convex/lib/confessions/confessions.test.ts`:

```typescript
import { describe, expect, it } from "vitest";

import { getDocumentText } from "./index";

/**
 * Corpus sanity: every ingested document is non-empty, carries its edition
 * note, and contains the numbering markers the model is told to cite by.
 * Tasks 2-6 append entries as documents are ingested.
 */
const EXPECTED: Array<{ id: string; markers: string[] }> = [
  { id: "ecumenical-creeds", markers: ["Apostles' Creed", "Nicene", "Athanasian"] },
  { id: "chalcedon", markers: ["Chalcedon", "one and the same"] },
  { id: "dordrecht", markers: ["Article I", "Article XVIII"] },
];

describe("confessions corpus", () => {
  it.each(EXPECTED)("$id resolves to a well-formed text", ({ id, markers }) => {
    const text = getDocumentText(id);
    expect(text).toBeDefined();
    expect(text!.length).toBeGreaterThan(500);
    expect(text).toContain("Text:"); // edition note header
    for (const marker of markers) {
      expect(text).toContain(marker);
    }
  });

  it("unknown id returns undefined", () => {
    expect(getDocumentText("not-a-real-id")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `(cd packages/backend && bunx vitest run convex/lib/confessions/confessions.test.ts)`
Expected: FAIL — cannot resolve `./index`.

- [ ] **Step 3: Fetch and normalize the three texts**

Sources (fetch with `curl -sL <url>`, then strip HTML — `WebFetch` output or a quick sed/manual pass is fine; the result must read as clean plain text):

| Document | Contents | Primary source | Fallback |
|---|---|---|---|
| Ecumenical Creeds | Apostles' Creed, Nicene-Constantinopolitan Creed (381, Western form with filioque noted), Athanasian Creed | Schaff, *Creeds of Christendom* vol. II via CCEL (`ccel.org/ccel/schaff/creeds2`) | Wikisource pages for each creed |
| Definition of Chalcedon | The definition (451) | Schaff, *Creeds of Christendom* vol. II via CCEL | NPNF series 2, vol. 14 (CCEL) |
| Dordrecht Confession | All 18 articles (1632, Mennonite) | `gameo.org` — "Dordrecht Confession of Faith (Mennonite, 1632)" | `anabaptists.org/history/dordrecht.html` |

Normalization for each: first line is the document title + date, second line `Text: <edition/translation note>`, blank line, then the content with original numbering. Dordrecht articles are numbered with Roman numerals (`Article I` … `Article XVIII`) — keep them.

- [ ] **Step 4: Create the three document modules and the index**

Each module has the shape (content abbreviated here — the real file holds the full normalized text):

```typescript
// packages/backend/convex/lib/confessions/chalcedon.ts
/** Definition of Chalcedon (451). Public domain (Schaff, Creeds of Christendom). */
export const TEXT = `The Definition of Chalcedon (451)
Text: Schaff, Creeds of Christendom, vol. II (public domain).

...full normalized text...`;
```

Create `packages/backend/convex/lib/confessions/index.ts`:

```typescript
import { TEXT as chalcedon } from "./chalcedon";
import { TEXT as dordrecht } from "./dordrecht";
import { TEXT as ecumenicalCreeds } from "./ecumenical-creeds";

/** Full public-domain texts of the confessional documents, keyed by DOCUMENTS id (studyData.ts). */
const TEXTS: Record<string, string> = {
  "ecumenical-creeds": ecumenicalCreeds,
  chalcedon,
  dordrecht,
};

export function getDocumentText(id: string): string | undefined {
  return TEXTS[id];
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `(cd packages/backend && bunx vitest run convex/lib/confessions/confessions.test.ts)`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add packages/backend/convex/lib/confessions/
git commit -m "feat(backend): confessions corpus scaffold + creeds, Chalcedon, Dordrecht"
```

---

### Task 2: Three Forms of Unity (Heidelberg, Belgic, Dort)

**Files:**
- Create: `packages/backend/convex/lib/confessions/heidelberg.ts`
- Create: `packages/backend/convex/lib/confessions/belgic.ts`
- Create: `packages/backend/convex/lib/confessions/dort.ts`
- Modify: `packages/backend/convex/lib/confessions/index.ts`
- Test: `packages/backend/convex/lib/confessions/confessions.test.ts`

**Interfaces:**
- Consumes: `TEXTS` map + `EXPECTED` table pattern from Task 1.
- Produces: texts for ids `"heidelberg"`, `"belgic"`, `"dort"`.

- [ ] **Step 1: Extend the test (failing)**

Append to `EXPECTED` in `confessions.test.ts`:

```typescript
  { id: "heidelberg", markers: ["Q. 1.", "Q. 129.", "Lord's Day"] },
  { id: "belgic", markers: ["Article 1", "Article 37"] },
  { id: "dort", markers: ["First Head", "Fifth Head", "Rejection"] },
```

- [ ] **Step 2: Run test to verify the new rows fail**

Run: `(cd packages/backend && bunx vitest run convex/lib/confessions/confessions.test.ts)`
Expected: FAIL — 3 new rows report `undefined` text.

- [ ] **Step 3: Fetch and normalize**

| Document | Contents | Primary source | Fallback |
|---|---|---|---|
| Heidelberg Catechism | All 129 Q&A, grouped by Lord's Day 1–52 | CRTA: `reformed.org/documents/heidelberg.html` | CCEL creeds collection |
| Belgic Confession | Articles 1–37 | CRTA: `reformed.org/documents/BelgicConfession.html` | CRCNA site |
| Canons of Dort | All five Heads of Doctrine incl. Rejection of Errors sections | CRTA: `reformed.org/documents/canons_of_dordt.html` | CCEL creeds collection |

Normalize Heidelberg Q&A as `Q. 1. <question>` / `A. <answer>` with `Lord's Day N` headings. Belgic uses `Article 1` … `Article 37` (Arabic numerals). Dort keeps `First Head of Doctrine` … plus each `Rejection of Errors` block. Keep Scripture proof references where the source edition prints them.

- [ ] **Step 4: Create modules, register in index**

Same module shape as Task 1 (title line, `Text:` edition note, full text). Add to `index.ts`:

```typescript
import { TEXT as belgic } from "./belgic";
import { TEXT as dort } from "./dort";
import { TEXT as heidelberg } from "./heidelberg";
// ...in TEXTS:
  heidelberg,
  belgic,
  dort,
```

- [ ] **Step 5: Run test to verify it passes**

Run: `(cd packages/backend && bunx vitest run convex/lib/confessions/confessions.test.ts)`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/backend/convex/lib/confessions/
git commit -m "feat(backend): ingest Three Forms of Unity"
```

---

### Task 3: Westminster Standards

**Files:**
- Create: `packages/backend/convex/lib/confessions/westminster.ts`
- Modify: `packages/backend/convex/lib/confessions/index.ts`
- Test: `packages/backend/convex/lib/confessions/confessions.test.ts`

**Interfaces:**
- Consumes: Task 1 patterns.
- Produces: text for id `"westminster"` (WCF + Larger Catechism + Shorter Catechism in one module, ~350KB — this is the largest module; it is fine as one file).

- [ ] **Step 1: Extend the test (failing)**

Append to `EXPECTED`:

```typescript
  {
    id: "westminster",
    markers: [
      "Westminster Confession of Faith",
      "Chapter I",
      "Chapter XXXIII",
      "The Larger Catechism",
      "Q. 196.",
      "The Shorter Catechism",
      "Q. 107.",
    ],
  },
```

- [ ] **Step 2: Run test to verify the new row fails**

Run: `(cd packages/backend && bunx vitest run convex/lib/confessions/confessions.test.ts)`
Expected: FAIL on the `westminster` row.

- [ ] **Step 3: Fetch and normalize**

| Part | Primary source | Fallback |
|---|---|---|
| WCF (33 chapters, 1646) | CRTA: `reformed.org/documents/wcf_with_proofs/` | CCEL, `thewestminsterstandard.org` |
| Larger Catechism (196 Q&A) | CRTA: `reformed.org/documents/larger1.html` | `thewestminsterstandard.org` |
| Shorter Catechism (107 Q&A) | CRTA: `reformed.org/documents/WSC.html` | CCEL |

One module, three parts, each introduced by its own heading line (`The Westminster Confession of Faith`, `The Larger Catechism`, `The Shorter Catechism`). WCF uses `Chapter I` … `Chapter XXXIII` with numbered sections (`I.`, `II.` or `Section 1.` — keep whatever the source edition uses, consistently). Catechisms use `Q. N.` / `A.`. Keep Scripture proofs where printed.

- [ ] **Step 4: Create module, register in index**

Add `import { TEXT as westminster } from "./westminster";` and `westminster,` to `TEXTS`.

- [ ] **Step 5: Run test to verify it passes**

Run: `(cd packages/backend && bunx vitest run convex/lib/confessions/confessions.test.ts)`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/backend/convex/lib/confessions/
git commit -m "feat(backend): ingest Westminster Standards"
```

---

### Task 4: 1689 London Baptist Confession

**Files:**
- Create: `packages/backend/convex/lib/confessions/london-1689.ts`
- Modify: `packages/backend/convex/lib/confessions/index.ts`
- Test: `packages/backend/convex/lib/confessions/confessions.test.ts`

**Interfaces:**
- Consumes: Task 1 patterns.
- Produces: text for id `"london-1689"`.

- [ ] **Step 1: Extend the test (failing)**

Append to `EXPECTED`:

```typescript
  { id: "london-1689", markers: ["Chapter 1", "Chapter 32", "Of the Holy Scriptures"] },
```

- [ ] **Step 2: Run test to verify the new row fails**

Run: `(cd packages/backend && bunx vitest run convex/lib/confessions/confessions.test.ts)`
Expected: FAIL on the `london-1689` row.

- [ ] **Step 3: Fetch and normalize**

All 32 chapters. Primary: CCEL creeds collection (`ccel.org/creeds/bcof.htm`). Fallbacks: `arbca.com/1689-confession`, `the1689confession.com`. Chapters numbered `Chapter 1` … `Chapter 32`, numbered paragraphs within each. Keep Scripture proofs where printed.

- [ ] **Step 4: Create module, register in index**

File name contains a hyphen, so the import is:

```typescript
import { TEXT as london1689 } from "./london-1689";
// ...in TEXTS:
  "london-1689": london1689,
```

- [ ] **Step 5: Run test to verify it passes**

Run: `(cd packages/backend && bunx vitest run convex/lib/confessions/confessions.test.ts)`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/backend/convex/lib/confessions/
git commit -m "feat(backend): ingest 1689 London Baptist Confession"
```

---

### Task 5: Lutheran standards (Augsburg + Luther's Catechisms)

**Files:**
- Create: `packages/backend/convex/lib/confessions/augsburg.ts`
- Create: `packages/backend/convex/lib/confessions/luthers-catechisms.ts`
- Modify: `packages/backend/convex/lib/confessions/index.ts`
- Test: `packages/backend/convex/lib/confessions/confessions.test.ts`

**Interfaces:**
- Consumes: Task 1 patterns.
- Produces: texts for ids `"augsburg"`, `"luthers-catechisms"`.

- [ ] **Step 1: Extend the test (failing)**

Append to `EXPECTED`:

```typescript
  { id: "augsburg", markers: ["Article I", "Article XXVIII", "Of Justification"] },
  { id: "luthers-catechisms", markers: ["Small Catechism", "Large Catechism", "The Ten Commandments"] },
```

- [ ] **Step 2: Run test to verify the new rows fail**

Run: `(cd packages/backend && bunx vitest run convex/lib/confessions/confessions.test.ts)`
Expected: FAIL on the two new rows.

- [ ] **Step 3: Fetch and normalize**

| Document | Contents | Primary source | Fallback |
|---|---|---|---|
| Augsburg Confession | All 28 articles (unaltered 1530; the Apology is NOT included) | `bookofconcord.org/augsburg-confession/` (1921 Triglot translation, public domain) | Wikisource |
| Luther's Catechisms | Small Catechism (complete) then Large Catechism (complete), in one module | `bookofconcord.org/small-catechism/` and `/large-catechism/` (Triglot) | CCEL |

Augsburg articles use Roman numerals (`Article I` … `Article XXVIII`) with their traditional titles (`Of Justification`, etc.). The catechisms module opens with `The Small Catechism` heading, then `The Large Catechism`; keep each part's own section structure (Ten Commandments, Creed, Lord's Prayer, sacraments).

- [ ] **Step 4: Create modules, register in index**

```typescript
import { TEXT as augsburg } from "./augsburg";
import { TEXT as luthersCatechisms } from "./luthers-catechisms";
// ...in TEXTS:
  augsburg,
  "luthers-catechisms": luthersCatechisms,
```

- [ ] **Step 5: Run test to verify it passes**

Run: `(cd packages/backend && bunx vitest run convex/lib/confessions/confessions.test.ts)`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/backend/convex/lib/confessions/
git commit -m "feat(backend): ingest Augsburg Confession and Luther's Catechisms"
```

---

### Task 6: Catholic standards (Trent, curated + Baltimore) and corpus completeness

**Files:**
- Create: `packages/backend/convex/lib/confessions/trent.ts`
- Create: `packages/backend/convex/lib/confessions/baltimore.ts`
- Modify: `packages/backend/convex/lib/confessions/index.ts`
- Test: `packages/backend/convex/lib/confessions/confessions.test.ts`

**Interfaces:**
- Consumes: Task 1 patterns; `DOCUMENTS` from `../studyData`.
- Produces: texts for ids `"trent"`, `"baltimore"`; the corpus-completeness test that locks all 12 ids.

- [ ] **Step 1: Extend the test (failing)**

Append to `EXPECTED`:

```typescript
  { id: "trent", markers: ["Session", "CANON", "Decree Concerning Justification"] },
  { id: "baltimore", markers: ["Lesson", "Q.", "Baltimore"] },
```

And add the completeness test (after the existing `it("unknown id ...")` block):

```typescript
import { DOCUMENTS } from "../studyData";

it("every DOCUMENTS id resolves to a text", () => {
  for (const doc of DOCUMENTS) {
    expect(getDocumentText(doc.id), `missing text for ${doc.id}`).toBeDefined();
  }
});
```

- [ ] **Step 2: Run test to verify the new rows fail**

Run: `(cd packages/backend && bunx vitest run convex/lib/confessions/confessions.test.ts)`
Expected: FAIL — two new marker rows + the completeness test.

- [ ] **Step 3: Fetch and normalize**

| Document | Contents | Primary source | Fallback |
|---|---|---|---|
| Council of Trent | **Doctrinal decrees and canons only** (per spec §1): the decrees "concerning faith"/doctrine and all doctrinal canons from Sessions 3–25 (notably Session 4 Scripture, 5 Original Sin, 6 Justification, 7 Sacraments, 13 Eucharist, 14 Penance, 21–22 Communion & Mass, 23–25 Orders, Matrimony, Purgatory/Saints). **Skip every "Decree Concerning Reform"** (clerical discipline). | Hanover Historical Texts Project: `history.hanover.edu/texts/trent.html` (Waterworth translation, 1848, public domain) | EWTN library copy of Waterworth |
| Baltimore Catechism | **No. 2** (the standard edition), all lessons | Project Gutenberg ebook #14552 (plain text UTF-8) | Gutenberg #14553 (No. 3) — if used, note it in the `Text:` line |

Trent keeps `Session N` headings, decree chapter numbers, and `CANON I.`-style canon numbering. Baltimore keeps `Lesson` headings and its native question numbering. Strip Gutenberg's license header/footer from the Baltimore text (keep only the catechism body; the `Text:` note records the Gutenberg source).

- [ ] **Step 4: Create modules, register in index**

```typescript
import { TEXT as baltimore } from "./baltimore";
import { TEXT as trent } from "./trent";
// ...in TEXTS:
  trent,
  baltimore,
```

- [ ] **Step 5: Run full corpus test to verify it passes**

Run: `(cd packages/backend && bunx vitest run convex/lib/confessions/confessions.test.ts)`
Expected: PASS — all 12 marker rows + unknown-id + completeness.

- [ ] **Step 6: Commit**

```bash
git add packages/backend/convex/lib/confessions/
git commit -m "feat(backend): ingest Trent (doctrinal decrees) and Baltimore Catechism; corpus complete"
```

---

### Task 7: Inject document text into the catechism prompt

**Files:**
- Modify: `packages/backend/convex/lib/prompts.ts` (catechism entry in `MODE_SECTIONS`, ~line 94)
- Test: `packages/backend/convex/lib/prompts.test.ts`

**Interfaces:**
- Consumes: `getDocumentText(id)` from `./confessions` (Task 1).
- Produces: catechism prompts containing the literal heading `## Document text (authoritative)` and the sentence `Do not quote this document from memory.` — Task 9's manual verification and any future tests rely on these exact strings.

- [ ] **Step 1: Write the failing tests**

Add to `prompts.test.ts` (inside the existing `describe`; add `DOCUMENTS` and `getDocumentText` imports at the top of the file):

```typescript
import { getDocumentText } from "./confessions";
import { DOCUMENTS } from "./studyData";

it("catechism injects the selected document's full text, for every document", () => {
  for (const doc of DOCUMENTS) {
    const prompt = buildSystemPrompt("catechism", { document: doc.id });
    expect(prompt, doc.id).toContain("## Document text (authoritative)");
    expect(prompt, doc.id).toContain("Do not quote this document from memory.");
    // The actual text is present, not just the heading:
    expect(prompt, doc.id).toContain(getDocumentText(doc.id)!.slice(0, 200));
  }
});

it("catechism with an unknown document falls back to no document block", () => {
  const prompt = buildSystemPrompt("catechism", { document: "not-a-real-id" });
  expect(prompt).toContain("## Mode: Catechism");
  expect(prompt).not.toContain("## Document text (authoritative)");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `(cd packages/backend && bunx vitest run convex/lib/prompts.test.ts)`
Expected: FAIL — no document block in the prompt.

- [ ] **Step 3: Implement the injection**

In `prompts.ts`, add the import:

```typescript
import { getDocumentText } from "./confessions";
```

Replace the `catechism` entry in `MODE_SECTIONS` with:

```typescript
  catechism: (setup) => {
    const doc = DOCUMENTS.find((d) => d.id === setup.document)?.label;
    const base = `## Mode: Catechism

You are tutoring the user through ${doc ?? "their chosen confessional document"}. Quote the document's own text in <article> blocks (source="${doc ?? "the document"}", label naming the question/chapter/section, proofs listing its Scripture proofs). Explain each article in plain language, cross-reference related articles, and give historical context for why it was written. When the user has worked through a stretch of material, quiz them on it — ask one question at a time, then assess their answer honestly before moving on.`;
    const text = setup.document ? getDocumentText(setup.document) : undefined;
    if (!doc || !text) return base;
    return `${base}

## Document text (authoritative)
The full text of ${doc} follows. When quoting the document, quote verbatim from this text only, and cite using its own numbering in <article> labels. Do not quote this document from memory.

${text}`;
  },
```

(The `base` string is today's catechism section verbatim — only the trailing document block is new.)

- [ ] **Step 4: Run the full backend test suite**

Run: `(cd packages/backend && bunx vitest run)`
Expected: PASS — new tests green, all pre-existing prompt/usage/plan tests untouched.

- [ ] **Step 5: Commit**

```bash
git add packages/backend/convex/lib/prompts.ts packages/backend/convex/lib/prompts.test.ts
git commit -m "feat(backend): catechism mode carries the selected document's full text"
```

---

### Task 8: Patristics guardrail in PERSONA and library mode

**Files:**
- Modify: `packages/backend/convex/lib/prompts.ts` (PERSONA line 18; library entry ~line 108)
- Test: `packages/backend/convex/lib/prompts.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks (independent of Tasks 1–7).
- Produces: the guardrail phrase `never cite volume or page numbers from memory` present in every mode's prompt.

- [ ] **Step 1: Write the failing tests**

Add to `prompts.test.ts`:

```typescript
it("persona carries the patristics guardrail in every mode", () => {
  const prompt = buildSystemPrompt("qa", { framework: "reformed" });
  expect(prompt).toContain("never cite volume or page numbers from memory");
  expect(prompt).toContain("paraphrase");
});

it("library mode reinforces citation discipline", () => {
  const prompt = buildSystemPrompt("library", { collection: "ante-nicene" });
  expect(prompt).toContain("book, chapter, section");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `(cd packages/backend && bunx vitest run convex/lib/prompts.test.ts)`
Expected: FAIL on both.

- [ ] **Step 3: Implement the guardrail**

In `PERSONA`, replace the line:

```
- Never invent quotations or citations. If you are not certain of a source's wording, characterize it without quoting.
```

with:

```
- Never invent quotations or citations. For primary sources not provided to you in this prompt — the Church Fathers especially — prefer close paraphrase with attribution ("Augustine argues in City of God that…"); give book or chapter references only when you are certain of them, and never cite volume or page numbers from memory. Quote verbatim only when you are confident of the exact wording.
```

In the `library` mode section, replace the sentence:

```
Only quote text you are confident is genuine; when uncertain, characterize the passage instead of quoting.
```

with:

```
Only quote text you are confident is genuine; when uncertain, characterize the passage instead of quoting. Cite by work and internal division (book, chapter, section) — never by volume or page number from memory.
```

- [ ] **Step 4: Run the full backend test suite**

Run: `(cd packages/backend && bunx vitest run)`
Expected: PASS. Note: the existing test `"every mode includes the persona, tag spec, and followups guidance"` checks `toContain("only when")` — the new PERSONA line contains "only when" too, so it stays green; verify nothing else asserts on the old sentence.

- [ ] **Step 5: Commit**

```bash
git add packages/backend/convex/lib/prompts.ts packages/backend/convex/lib/prompts.test.ts
git commit -m "feat(backend): patristics anti-fabrication guardrail in persona and library mode"
```

---

### Task 9: Prompt caching attempt + live verification

**Files:**
- Modify: `packages/backend/convex/chat.ts` (`streamReply`, lines 165–198)
- Modify: `docs/NEXT_STEPS.md` (caching item — record outcome either way)

**Interfaces:**
- Consumes: the enlarged catechism system prompt (Task 7); `usageHandler` in `convex/usage.ts` (already extracts `cacheReadInputTokens` from `providerMetadata.anthropic` / `usage.cachedInputTokens` — lines 81–95).
- Produces: either a cached system prompt in production code, or a documented finding on NEXT_STEPS. No other task depends on this one.

This task is exploratory by design (spec §5). Work it in this order:

- [ ] **Step 1: Investigate the option-passing path**

Read the installed types — no guessing:

```bash
rg -n "providerOptions|system" packages/backend/node_modules/@convex-dev/agent/dist/esm/client/types.d.ts | head -40
```

Determine which of these `theologiaAgent.streamText` supports (in preference order):
1. `system` accepted as a message object/array with per-message `providerOptions` (AI SDK `SystemModelMessage` carries `providerOptions`).
2. Extra `messages` prepended alongside `promptMessageId`, allowing a leading `{ role: "system", content, providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } } }` message.
3. Call-level `providerOptions` forwarded to the provider (check `@ai-sdk/anthropic` docs/types for whether call-level `anthropic.cacheControl` exists — as of v3 it is message/part-level only, so this path likely does not cache).

- [ ] **Step 2: Implement (if a path exists)**

Using path 1 as the example shape — in `streamReply`, replace `system` with the provider-annotated form:

```typescript
const result = await theologiaAgent.streamText(
  ctx,
  { threadId: args.threadId },
  {
    promptMessageId: args.promptMessageId,
    system: {
      role: "system",
      content: system,
      providerOptions: {
        anthropic: { cacheControl: { type: "ephemeral" } },
      },
    },
    model,
  },
  { saveStreamDeltas: { chunking: "word" } },
);
```

Adapt to whichever path Step 1 found (the exact shape depends on the agent's types — compile against them, don't force this literal). If no path exists, skip to Step 4 (fallback).

- [ ] **Step 3: Verify live**

1. Start the dev stack (`bun run dev` at repo root; backend is master-direct on port 3001 per project notes).
2. In the app, open a Catechism conversation on Westminster Standards and send two messages a few seconds apart.
3. Check recorded usage — `recordUsage` writes `cacheReadTokens` — via the Convex dashboard table or:
   ```bash
   (cd packages/backend && bunx convex data usageEvents --limit 4)
   ```
   (If the table name differs, check `recordUsage` in `convex/usage.ts` for the actual insert target.)
4. Expected: message 1 shows `cacheWriteTokens > 0`; message 2 shows `cacheReadTokens > 0`. Also confirm `uncachedInputTokens` is not negative — that validates the NEXT_STEPS `usageHandler` token-extraction assumption (whether AI SDK `inputTokens` includes cache tokens); if it is negative or double-counted, fix the arithmetic in `usageHandler` accordingly.

- [ ] **Step 4: Record the outcome in NEXT_STEPS.md**

- If caching shipped: rewrite the "Prompt caching" bullet to reflect what remains (e.g. extending breakpoints to conversation history), noting `cache_read_input_tokens` verified nonzero and the `usageHandler` assumption confirmed.
- If blocked: keep the bullet, append the concrete finding (which API surface is missing on `@convex-dev/agent@0.6.x`) and the measured per-message cost accepted in the interim (≈ $0.18 input/message worst case, Westminster).

- [ ] **Step 5: Commit**

```bash
git add packages/backend/convex/chat.ts docs/NEXT_STEPS.md
git commit -m "feat(backend): cache catechism system prompt (or: docs: record caching blocker)"
```

---

## Self-Review Notes

- **Spec coverage:** §1 corpus → Tasks 1–6 (curation calls included: Trent doctrinal-only in Task 6, Small+Large in Task 5, WCF+WLC+WSC in Task 3). §2 layout → Task 1. §3 prompt assembly + fallback → Task 7. §4 guardrail → Task 8. §5 caching + fallback → Task 9. §6 cost envelope — no task needed (informational). §7 testing → Tasks 1–8. §8 out of scope — no tasks touch Q&A injection, RAG, or gating.
- **Type consistency:** `getDocumentText(id: string): string | undefined` used identically in Tasks 1, 7; `TEXT` export name identical across all document modules; `EXPECTED` table shape identical across Tasks 1–6.
- **Known open point:** Task 9 Step 2's code block is a template — the binding truth comes from Step 1's type inspection. This is deliberate (spec names it a known risk with a defined fallback).

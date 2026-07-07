# Mode Trim + Sermon Prep + Mode Info Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trim the study-mode picker from 8 to 7 modes (merge Debate Prep into Devil's Advocate, fold Resources into Q&A), add a new Sermon Prep mode, and add an info icon + modal explaining each mode's use cases.

**Architecture:** Backend (`packages/backend/convex`) keeps the legacy `debate-prep`/`resources` mode ids in the schema validator, `ModeId`, `MODE_SETUP`, and prompt sections so live conversations keep working unchanged; only the frontend `MODES` picker list drops them, with `getMode()` aliasing legacy ids for old-thread rendering. The new `sermon-prep` mode is added end-to-end (schema literal, prompt section, picker entry). The info modal is a new self-contained component on `@base-ui/react` Dialog, fed by a new `useCases` field on `Mode`.

**Tech Stack:** Convex, Next.js/React, `@base-ui/react` (Dialog), `lucide-react`, CSS modules, vitest. Monorepo uses bun; run tests with `npx vitest run` inside each package directory.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-07-mode-trim-sermon-prep-design.md`.
- No data migration. `vMode` only widens (adds `sermon-prep`); never remove `debate-prep`/`resources` literals.
- Old conversations must keep their exact prompt behavior (backend `MODE_SECTIONS` keeps legacy entries) and must still render in the UI (frontend legacy alias map).
- Ellipses in UI copy use the `…` character (matches existing copy).
- CSS modules that portal to `document.body` must re-declare the palette tokens locally (see `apps/web/src/components/chip-select.module.css` header comment for why).

---

### Task 1: Backend — sermon-prep mode id, schema literal, prompt sections (merge + new)

**Files:**
- Modify: `packages/backend/convex/lib/studyData.ts` (ModeId union ~line 7, MODE_SETUP ~line 206)
- Modify: `packages/backend/convex/schema.ts` (vMode union, lines 4–13)
- Modify: `packages/backend/convex/lib/prompts.ts` (MODE_SECTIONS, lines 71–118)
- Test: `packages/backend/convex/lib/prompts.test.ts`

**Interfaces:**
- Produces: `ModeId` now includes `"sermon-prep"`; `MODE_SETUP["sermon-prep"] === "tradition"`; `buildSystemPrompt("sermon-prep", { framework })` returns a Sermon Prep section. Task 2 (frontend) imports `ModeId`, `MODE_SETUP` from `@theologia/backend/convex/lib/studyData` and relies on these exact values.

- [ ] **Step 1: Write the failing tests**

In `packages/backend/convex/lib/prompts.test.ts`:

1. In the first test (`every mode includes the persona…`), add `"sermon-prep"` to the `modes` array.
2. Replace the `devils-advocate` test body and add two new tests:

```ts
  it("devils-advocate names both traditions, ranks objections, and drills responses", () => {
    const prompt = buildSystemPrompt("devils-advocate", {
      framework: "reformed",
      opposing: "arminian-wesleyan",
    });
    expect(prompt).toContain("Reformed");
    expect(prompt).toContain("Arminian");
    expect(prompt).toContain('kind="objection"');
    expect(prompt).toContain("strawman");
    expect(prompt).toContain("weight");
    expect(prompt).toContain("assess the answer candidly");
  });

  it("qa offers reading recommendations via the resources tag", () => {
    const prompt = buildSystemPrompt("qa", { framework: "reformed" });
    expect(prompt).toContain("<resources>");
  });

  it("sermon-prep equips the preacher without writing the sermon", () => {
    const prompt = buildSystemPrompt("sermon-prep", { framework: "baptist" });
    expect(prompt).toContain("Baptist");
    expect(prompt).toContain("preach");
    expect(prompt).toContain("illustration");
    expect(prompt).toContain("application");
    expect(prompt).toContain("do not write the sermon");
  });
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `cd packages/backend && npx vitest run convex/lib/prompts.test.ts`
Expected: FAIL — TypeScript error on `"sermon-prep"` not assignable to `ModeId` (and/or missing `MODE_SECTIONS` entry).

- [ ] **Step 3: Add sermon-prep to studyData.ts and schema.ts, mark legacy ids**

In `packages/backend/convex/lib/studyData.ts`, replace the `ModeId` type (lines 7–15) with:

```ts
export type ModeId =
  | "qa"
  | "devils-advocate"
  | "comparison"
  | "catechism"
  | "library"
  | "scripture-study"
  | "sermon-prep"
  // Legacy — no longer offered in the UI; kept so existing conversations
  // remain valid. debate-prep merged into devils-advocate; resources
  // folded into qa.
  | "debate-prep"
  | "resources";
```

Replace `MODE_SETUP` (lines 206–215) with:

```ts
export const MODE_SETUP: Record<ModeId, SetupKind> = {
  qa: "tradition",
  "devils-advocate": "versus",
  comparison: "multi-tradition",
  catechism: "document",
  library: "collection",
  "scripture-study": "tradition",
  "sermon-prep": "tradition",
  // Legacy modes (see ModeId).
  "debate-prep": "versus",
  resources: "tradition-purpose",
};
```

In `packages/backend/convex/schema.ts`, replace the `vMode` union (lines 4–13) with:

```ts
export const vMode = v.union(
  v.literal("qa"),
  v.literal("devils-advocate"),
  v.literal("comparison"),
  v.literal("catechism"),
  v.literal("library"),
  v.literal("scripture-study"),
  v.literal("sermon-prep"),
  // Legacy modes — kept so existing conversations remain valid.
  v.literal("debate-prep"),
  v.literal("resources"),
);
```

- [ ] **Step 4: Update prompt sections in prompts.ts**

In `packages/backend/convex/lib/prompts.ts`:

1. Append one sentence to the end of the `qa` section string (line 74), after "…are welcome when apt.":

```
 When the user asks what to read on a topic, recommend it as a <resources> block — primary sources first, honest tier labels.
```

2. Replace the `"devils-advocate"` entry (lines 76–80) with the merged section (absorbs debate-prep's ranking/weights/drilling):

```ts
  "devils-advocate": (setup) => `## Mode: Devil's Advocate

The user holds ${traditionClause(setup)}. You argue the case of the ${frameworkLabel(setup.opposing) || "opposing"} tradition against the doctrine, passage, or thesis the user names — the strongest form of each argument, as a serious, well-read ${frameworkLabel(setup.opposing) || "opposing"} theologian would actually make it. Never a strawman; never soften the challenge.

Present objections as <points kind="objection"> with sharp titles, ranked strongest first, each with a weight attribute saying how central it is. When the user asks how their own tradition answers, give the real answers of its best exegetes as <points kind="response">, in the same order. When the user answers an objection in their own words, assess the answer candidly and press where a capable opponent would press. Keep the debate going in character — say where the argument migrates next and why. A history aside placing the debate in the church's story is often warranted here.`,
```

3. Add the `"sermon-prep"` entry after `"scripture-study"`:

```ts
  "sermon-prep": (setup) => `## Mode: Sermon Prep

The user is preparing to preach from within ${traditionClause(setup)}. For the passage or theme they bring, surface what a faithful expositor needs: quote the text in a <scripture> block, give original-language notes in a <lexicon> block where the vocabulary matters, supply historical and literary context, and present the tradition's confessional and doctrinal reading. Bring in the Fathers and later interpreters via <source> blocks where their voice will preach, and use a <history> aside for church-history material that can serve as sermon illustration. Note cross-references worth weaving in, and name common misreadings of the passage so the preacher can avoid them. Close with pastoral application angles — where the text presses on a congregation's life. You equip the preacher; you do not write the sermon. Suggest outline directions only when asked.`,
```

4. Add a comment line directly above the `"debate-prep"` entry and above the `resources` entry:

```ts
  // Legacy mode — no longer offered in the UI; kept so existing
  // conversations keep their original behavior.
```

Do not otherwise change the `debate-prep`, `resources`, `comparison`, `catechism`, `library`, or `scripture-study` sections.

- [ ] **Step 5: Run backend tests**

Run: `cd packages/backend && npx vitest run`
Expected: PASS (all files, including the pre-existing `debate-prep`/`resources` prompt tests, which must keep passing).

- [ ] **Step 6: Commit**

```bash
git add packages/backend/convex/lib/studyData.ts packages/backend/convex/schema.ts packages/backend/convex/lib/prompts.ts packages/backend/convex/lib/prompts.test.ts
git commit -m "feat(backend): sermon-prep mode; merge debate-prep drilling into devils-advocate prompt"
```

---

### Task 2: Frontend — trim MODES to 7, add sermon-prep + useCases, legacy aliases in getMode

**Files:**
- Modify: `apps/web/src/components/chat/lib/modes.ts`
- Test: `apps/web/src/components/chat/lib/modes.test.ts`

**Interfaces:**
- Consumes: `ModeId`, `MODE_SETUP` from Task 1 (via `@theologia/backend/convex/lib/studyData`).
- Produces: `Mode` interface gains `useCases: string[]`; `MODES` has exactly 7 entries in order `qa, devils-advocate, comparison, catechism, library, scripture-study, sermon-prep`; `getMode("debate-prep")` returns the `devils-advocate` mode and `getMode("resources")` returns the `qa` mode. Task 3 renders `MODES[n].useCases` in the dialog.

- [ ] **Step 1: Update tests to the new lineup (failing first)**

In `apps/web/src/components/chat/lib/modes.test.ts`, replace the `describe("MODES", …)` block with:

```ts
describe("MODES", () => {
  it("defines the seven active modes with qa first and sermon-prep last", () => {
    expect(MODES.map((m) => m.id)).toEqual([
      "qa",
      "devils-advocate",
      "comparison",
      "catechism",
      "library",
      "scripture-study",
      "sermon-prep",
    ]);
  });

  it("gives every mode three sample prompts and full copy", () => {
    for (const mode of MODES) {
      expect(mode.samplePrompts).toHaveLength(3);
      expect(mode.label.length).toBeGreaterThan(0);
      expect(mode.heading.em.length).toBeGreaterThan(0);
      expect(mode.lede.length).toBeGreaterThan(0);
      expect(mode.placeholder.length).toBeGreaterThan(0);
      expect(mode.useCases.length).toBeGreaterThanOrEqual(2);
      for (const useCase of mode.useCases) {
        expect(useCase.length).toBeGreaterThan(0);
      }
    }
  });

  it("getMode aliases legacy modes to their successors", () => {
    expect(getMode("debate-prep").id).toBe("devils-advocate");
    expect(getMode("resources").id).toBe("qa");
    expect(getMode("sermon-prep").setup).toBe("tradition");
  });
});
```

In the `describeSetup` tests, change the legacy-resources expectation (the last `expect` in `labels comparison, document, collection, and purpose setups`) from `"Reformed · Sermon prep"` to `"Reformed"` — a legacy resources conversation now renders under qa's `tradition` setup, dropping the purpose suffix (accepted in the spec). Leave every `isSetupValid` test unchanged (legacy ids remain valid inputs), and add one line to the tradition test:

```ts
    expect(isSetupValid("sermon-prep", { framework: "baptist" })).toBe(true);
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web && npx vitest run src/components/chat/lib/modes.test.ts`
Expected: FAIL — MODES has 8 entries, no `useCases`, `getMode("debate-prep").id` is `"debate-prep"`.

- [ ] **Step 3: Rewrite modes.ts**

In `apps/web/src/components/chat/lib/modes.ts`:

1. Add `useCases: string[];` to the `Mode` interface after `samplePrompts`.
2. Update the doc comment above `MODES` to: `The seven study modes — GOAL.md's features rendered as one chat surface, trimmed of overlap (debate-prep merged into devils-advocate, resources folded into qa). Church History Surfacing is not a mode; it appears as `history` blocks woven into answers across modes.`
3. Delete the `debate-prep` and `resources` entries from `MODES`.
4. Update the `devils-advocate` lede to: `Lock in your tradition, choose a rival, and hear its best case — argued seriously, never as a strawman — then drill your answers until they hold.`
5. Add `useCases` to each remaining entry:

```ts
// qa
useCases: [
  "Quick doctrine checks — “what does my church teach about this?”",
  "Working through a hard passage or objection inside your own tradition",
  "Asking what to read on a topic",
],
// devils-advocate
useCases: [
  "Stress-testing a doctrine against a rival tradition's best arguments",
  "Preparing to defend a thesis — ranked objections, then drilling your answers",
],
// comparison
useCases: [
  "Seeing where the traditions actually divide on a doctrine",
  "Preparing to teach a fair survey of views",
],
// catechism
useCases: [
  "Working through a confession or catechism with a tutor",
  "Being quizzed on the articles you have read",
],
// library
useCases: [
  "Finding what the Fathers and councils actually said",
  "Tracing a doctrine through the primary sources",
],
// scripture-study
useCases: [
  "Deep study of one passage — language, context, interpreters",
  "Understanding how your tradition reads a disputed text",
],
```

6. Append the sermon-prep entry after `scripture-study`:

```ts
  {
    id: "sermon-prep",
    label: "Sermon Prep",
    heading: { pre: "Prepare to ", em: "preach", post: " the text." },
    lede: "Bring Sunday's passage or theme. Exegesis, historical context, your tradition's reading, and the church's voice on the text — the study behind the sermon.",
    placeholder: "Enter your sermon passage or theme…",
    setup: MODE_SETUP["sermon-prep"],
    samplePrompts: [
      { topic: "Passage", prompt: "I'm preaching John 6:35–58 this Sunday." },
      { topic: "Theme", prompt: "A sermon on assurance from Romans 8." },
      { topic: "Series", prompt: "Beginning a series on the Lord's Prayer." },
    ],
    useCases: [
      "You're preaching soon and need the study behind the text",
      "Gathering exegesis, illustrations, and application angles",
      "Checking your reading against the tradition before you preach",
    ],
  },
```

7. Replace `getMode` (lines 176–180) with:

```ts
/** Modes removed from the picker but still present on old conversations. */
const LEGACY_MODE_ALIASES: Partial<Record<ModeId, ModeId>> = {
  "debate-prep": "devils-advocate",
  resources: "qa",
};

export function getMode(id: ModeId): Mode {
  const mode = MODES.find((m) => m.id === id);
  if (mode) return mode;
  const alias = LEGACY_MODE_ALIASES[id];
  if (alias) return getMode(alias);
  throw new Error(`Unknown mode: ${id}`);
}
```

Note: `describeSetup` needs no change — legacy conversations resolve through the aliased mode's setup kind.

- [ ] **Step 4: Run the web test suite and typecheck**

Run: `cd apps/web && npx vitest run && npx tsc --noEmit`
Expected: PASS / no type errors. (`setup-picker.tsx`'s `tradition-purpose` branch stays — the SetupKind type still includes it for legacy completeness.)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/chat/lib/modes.ts apps/web/src/components/chat/lib/modes.test.ts
git commit -m "feat(web): trim modes to seven, add sermon-prep, alias legacy mode ids"
```

---

### Task 3: Frontend — mode info dialog + info icon in the picker row

**Files:**
- Create: `apps/web/src/components/chat/mode-info-dialog.tsx`
- Create: `apps/web/src/components/chat/mode-info-dialog.module.css`
- Modify: `apps/web/src/components/chat/mode-picker.tsx`
- Modify: `apps/web/src/components/chat/mode-picker.module.css`

**Interfaces:**
- Consumes: `MODES` (with `useCases`) from Task 2.
- Produces: `ModeInfoDialog` default-export component (no props) rendered inside the mode picker row.

- [ ] **Step 1: Create the dialog component**

`apps/web/src/components/chat/mode-info-dialog.tsx`:

```tsx
"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Info, X } from "lucide-react";

import { MODES } from "./lib/modes";
import styles from "./mode-info-dialog.module.css";

/** Info icon beside the mode picker; opens a modal explaining each mode. */
export default function ModeInfoDialog() {
  return (
    <Dialog.Root>
      <Dialog.Trigger
        className={styles.trigger}
        aria-label="About the study modes"
      >
        <Info size={13} aria-hidden />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className={styles.backdrop} />
        <Dialog.Popup className={styles.popup}>
          <div className={styles.head}>
            <Dialog.Title className={styles.title}>
              What each mode is for
            </Dialog.Title>
            <Dialog.Close className={styles.close} aria-label="Close">
              <X size={14} aria-hidden />
            </Dialog.Close>
          </div>
          <div className={styles.list}>
            {MODES.map((mode) => (
              <section key={mode.id} className={styles.mode}>
                <h3 className={styles.modeLabel}>{mode.label}</h3>
                <p className={styles.modeLede}>{mode.lede}</p>
                <ul className={styles.useCases}>
                  {mode.useCases.map((useCase) => (
                    <li key={useCase}>{useCase}</li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

- [ ] **Step 2: Create the CSS module**

`apps/web/src/components/chat/mode-info-dialog.module.css` — the backdrop and popup portal to `document.body`, outside the chat `.root` that defines the palette, so tokens are re-declared locally (same pattern as `chip-select.module.css`):

```css
.backdrop,
.popup {
  --ink-deep: #0b0805;
  --parchment: #f1e8d6;
  --parchment-dim: #b9a886;
  --stone: #8a7d68;
  --gold: #c9a24e;
  --gold-bright: #e6c984;
  --hairline: rgba(201, 162, 78, 0.26);
}

/* The trigger renders inside the chat root, so it inherits the palette. */
.trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.7rem;
  height: 1.7rem;
  color: var(--parchment-dim);
  background: transparent;
  border: 1px solid var(--hairline);
  border-radius: 2px;
  cursor: pointer;
  transition:
    color 0.22s ease,
    border-color 0.22s ease;
}
.trigger:hover,
.trigger[data-popup-open] {
  color: var(--gold);
  border-color: rgba(201, 162, 78, 0.55);
}
.trigger:focus-visible {
  outline: 1px solid var(--gold);
  outline-offset: 2px;
}

.backdrop {
  position: fixed;
  inset: 0;
  z-index: 60;
  background: rgba(4, 3, 1, 0.66);
}

.popup {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 61;
  box-sizing: border-box;
  width: min(34rem, calc(100vw - 2rem));
  max-height: min(80vh, 42rem);
  overflow-y: auto;
  padding: 1.5rem 1.75rem;
  background: #120e08;
  border: 1px solid var(--hairline);
  border-radius: 2px;
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.55);
  scrollbar-color: var(--hairline) transparent;
  outline: none;
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.1rem;
}

.title {
  margin: 0;
  font-family: var(--font-geist-mono), monospace;
  font-size: 0.68rem;
  font-weight: 400;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--gold);
}

.close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.6rem;
  height: 1.6rem;
  color: var(--stone);
  background: transparent;
  border: none;
  border-radius: 2px;
  cursor: pointer;
  transition: color 0.22s ease;
}
.close:hover {
  color: var(--parchment);
}
.close:focus-visible {
  outline: 1px solid var(--gold);
  outline-offset: 2px;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}

.mode {
  padding-top: 1.1rem;
  border-top: 1px solid rgba(201, 162, 78, 0.14);
}
.mode:first-child {
  padding-top: 0;
  border-top: none;
}

.modeLabel {
  margin: 0 0 0.3rem;
  font-family: var(--font-geist-mono), monospace;
  font-size: 0.62rem;
  font-weight: 400;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--parchment);
}

.modeLede {
  margin: 0 0 0.45rem;
  font-size: 0.82rem;
  line-height: 1.55;
  color: var(--parchment-dim);
}

.useCases {
  margin: 0;
  padding-left: 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  font-size: 0.78rem;
  line-height: 1.5;
  color: var(--stone);
}
.useCases li::marker {
  color: var(--gold);
}
```

- [ ] **Step 3: Add the trigger to the mode picker row**

Replace `apps/web/src/components/chat/mode-picker.tsx` with (the tablist wraps only the tab chips; the info trigger sits beside it so the ARIA tablist stays valid):

```tsx
"use client";

import type { ModeId } from "./lib/chat-state";
import { MODES } from "./lib/modes";
import ModeInfoDialog from "./mode-info-dialog";
import styles from "./mode-picker.module.css";

/** The study-mode selector on the new-study screen. */
export default function ModePicker({
  mode,
  onChange,
}: {
  mode: ModeId;
  onChange: (mode: ModeId) => void;
}) {
  return (
    <div className={styles.row}>
      <div className={styles.tabs} role="tablist" aria-label="Study mode">
        {MODES.map((m) => {
          const isActive = m.id === mode;
          return (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`${styles.chip} ${isActive ? styles.chipActive : ""}`}
              onClick={() => onChange(m.id)}
            >
              {m.label}
            </button>
          );
        })}
      </div>
      <ModeInfoDialog />
    </div>
  );
}
```

In `apps/web/src/components/chat/mode-picker.module.css`, replace the `.row` rule with:

```css
.row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
}

.tabs {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.45rem;
}
```

- [ ] **Step 4: Typecheck, run tests, and verify in the app**

Run: `cd apps/web && npx tsc --noEmit && npx vitest run`
Expected: no type errors, all tests pass.

Then verify visually: `cd apps/web && bun dev` (port 3001), open the chat's new-study screen and confirm: seven chips + info icon in one centered row; clicking the icon opens the centered modal listing all seven modes with ledes and use-case bullets; Escape, backdrop click, and the × button all close it; chips still switch modes.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/chat/mode-info-dialog.tsx apps/web/src/components/chat/mode-info-dialog.module.css apps/web/src/components/chat/mode-picker.tsx apps/web/src/components/chat/mode-picker.module.css
git commit -m "feat(web): mode info dialog explaining each study mode's use cases"
```

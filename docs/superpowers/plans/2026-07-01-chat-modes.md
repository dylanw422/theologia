# /chat Multi-Mode Study Surface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the v1 `/chat` shell so all eight GOAL.md features exist as selectable chat modes with scripted, mock-driven multi-step flows and rich block-based answer rendering.

**Architecture:** One stateful `ChatApp`; pure state helpers + a small script engine in `lib/`; per-mode script content files; three new presentational components (mode picker, setup picker, message blocks). No backend — in-memory state, canned content.

**Tech Stack:** Next.js 16 / React, CSS modules per `docs/DESIGN.md`, Vitest for pure logic.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-01-chat-modes-design.md`.
- All new chat code lives under `apps/web/src/components/chat/`; colocated `*.module.css`.
- Design tokens per `docs/DESIGN.md`: Fraunces display, Geist Mono apparatus, Inter body; gold sparingly; 2px radii; `--hairline` rules; `prefers-reduced-motion` guards on decorative motion.
- Tests: `cd apps/web && bun run test` (Vitest). Typecheck via `bunx tsc --noEmit` in `apps/web`.
- **Content dictionaries** (comparison per-tradition entries; catechism per-document articles; all script prose): authored at implementation time with serious, accurate theological content in GOAL.md's register; coverage is gated by the structural tests in Tasks 6–8, so no entry can be skipped.
- Commit after each task.

---

### Task 1: Block/message/conversation model

**Files:**
- Modify: `apps/web/src/components/chat/lib/chat-state.ts`
- Test: `apps/web/src/components/chat/lib/chat-state.test.ts`

**Interfaces (produces):**

```ts
export type ModeId =
  | "qa" | "devils-advocate" | "comparison" | "debate-prep"
  | "catechism" | "resources" | "library" | "scripture-study";

export type Block =
  | { type: "prose"; text: string }
  | { type: "scripture"; reference: string; text: string }
  | { type: "history"; heading: string; text: string }
  | { type: "lexicon"; entries: { term: string; translit: string; gloss: string }[] }
  | { type: "comparison"; columns: { tradition: string; position: string; texts: string; theologians: string }[] }
  | { type: "points"; kind: "objection" | "response"; items: { title: string; body: string; weight?: string }[] }
  | { type: "resources"; items: { title: string; author: string; tier: "introductory" | "intermediate" | "scholarly"; note: string }[] }
  | { type: "source"; work: string; author: string; citation: string; excerpt: string }
  | { type: "article"; source: string; label: string; body: string; proofs?: string[] };

export interface Action { id: string; label: string; prefill: string; next: string; }

export interface Message {
  id: string; role: Role; content: string;
  blocks?: Block[]; actions?: Action[];
}

export interface ConversationSetup {
  framework?: string; subTradition?: string; opposing?: string;
  traditions?: string[]; document?: string; purpose?: string; collection?: string;
}

export interface Conversation extends ConversationSetup {
  id: string; title: string; mode: ModeId;
  messages: Message[];
  nextTypedStep?: string;
}

export function createConversation(input: { mode: ModeId; setup: ConversationSetup; firstMessage: string }): Conversation;
export function appendMessage(c: Conversation, m: { role: Role; content: string; blocks?: Block[]; actions?: Action[] }): Conversation;
export function blocksToText(blocks: Block[]): string; // flatten for the copy button
export function deriveTitle(text: string): string;     // unchanged
```

- [x] **Step 1: Update existing tests + add new failing tests** — `createConversation` now takes `{ mode, setup, firstMessage }`; add tests: mode + setup fields land on the conversation; `blocksToText` joins prose/scripture/history text with blank lines; `appendMessage` preserves `blocks`/`actions` and stays immutable.
- [x] **Step 2: Run tests, verify new ones fail.**
- [x] **Step 3: Implement model changes** (spread `setup` into the conversation; `blocksToText` switch over block types: prose→text, scripture→`reference — text`, history→`heading — text`, source→`work, citation — excerpt`, article→`label — body`, points→items `title: body`, resources→items `title (author)`, comparison→columns `tradition: position`, lexicon→entries `term (translit): gloss`).
- [x] **Step 4: Tests pass.**
- [x] **Step 5: Commit** `feat(chat): block-based message model + mode-aware conversations`

### Task 2: Script engine

**Files:**
- Create: `apps/web/src/components/chat/lib/scripts/types.ts`
- Modify: `apps/web/src/components/chat/lib/chat-state.ts`
- Test: `apps/web/src/components/chat/lib/chat-state.test.ts`

**Interfaces (produces):**

```ts
// scripts/types.ts
import type { Action, Block, Conversation } from "../chat-state";
export interface ScriptStep {
  blocks: Block[] | ((c: Conversation) => Block[]);
  actions?: Action[];
  onReply?: string;      // step id used for the NEXT typed user message
}
export interface Script {
  entry: string;
  steps: Record<string, ScriptStep>;
  fallback: Block[];     // typed message with no pending onReply
}

// chat-state.ts
export interface ReplyParts { blocks: Block[]; actions?: Action[]; nextTypedStep?: string; }
export function replyFor(c: Conversation, script: Script, opts?: { actionNext?: string; isFirst?: boolean }): ReplyParts;
export function withReply(c: Conversation, script: Script, opts?: { actionNext?: string; isFirst?: boolean }): Conversation;
```

Resolution order in `replyFor`: `opts.actionNext` → that step; else `opts.isFirst` → `script.entry`; else `c.nextTypedStep` → that step; else `{ blocks: script.fallback }`. Function-valued `blocks` are called with the conversation. `nextTypedStep` in the result is the resolved step's `onReply` (undefined when fallback). `withReply` appends the assistant message (`content: blocksToText(blocks)`) and sets/clears `nextTypedStep`.

- [x] **Step 1: Failing tests** with a stub script (entry step with an action → step "b" with `onReply: "c"` → step "c"): entry on `isFirst`; action routing; `onReply` consumed by next typed reply then cleared; fallback when nothing pending; function blocks receive the conversation.
- [x] **Step 2: Verify fail. Step 3: Implement. Step 4: Pass.**
- [x] **Step 5: Commit** `feat(chat): script engine for mocked multi-step flows`

### Task 3: Mode definitions

**Files:**
- Create: `apps/web/src/components/chat/lib/modes.ts`
- Test: `apps/web/src/components/chat/lib/modes.test.ts`

**Interfaces (produces):**

```ts
export type SetupKind = "tradition" | "versus" | "multi-tradition" | "document" | "tradition-purpose" | "collection";
export interface Mode {
  id: ModeId; label: string;                      // "Q&A", "Devil's Advocate", …
  heading: { pre: string; em: string; post: string };
  lede: string; placeholder: string;
  setup: SetupKind;
  samplePrompts: { topic: string; prompt: string }[];  // 3 per mode
}
export const MODES: Mode[];                        // 8, qa first
export function getMode(id: ModeId): Mode;
export const DOCUMENTS: { id: string; label: string }[];    // 12 from GOAL.md
export const COLLECTIONS: { id: string; label: string }[];  // 6 library eras
export const PURPOSES: { id: string; label: string }[];     // 4 from GOAL.md
export function isSetupValid(mode: ModeId, setup: ConversationSetup): boolean;
export function describeSetup(c: Pick<Conversation, keyof ConversationSetup | "mode">): string;
```

Validity: `qa`/`scripture-study` need `framework`; `versus` modes need `framework` + `opposing` + different; `comparison` needs 2–4 unique `traditions`; `catechism` needs `document`; `resources` needs `framework` + `purpose`; `library` always valid. `describeSetup` → `"Reformed · Reformed Baptist"`, `"Reformed vs Arminian"`, `"Reformed · Arminian · Roman Catholic"` (comparison), document/collection/purpose labels, `""` for bare library. Document ids: `westminster`, `heidelberg`, `belgic`, `dort`, `london-1689`, `augsburg`, `luthers-catechisms`, `ecumenical-creeds`, `chalcedon`, `trent`, `baltimore`, `dordrecht`. Collections: `apostolic-fathers`, `ante-nicene`, `nicene-post-nicene`, `medieval`, `reformation`, `councils`. Purposes: `debate-prep`, `sermon-prep`, `personal-study`, `academic-research`.

- [x] **Steps 1–4 (TDD):** tests: 8 modes with qa first + unique ids; 3 sample prompts each; 12 documents; validity matrix (one assert per rule above, positive + negative); `describeSetup` cases. Implement to pass.
- [x] **Step 5: Commit** `feat(chat): mode definitions, setup validity, labels`

### Task 4: Scripts — qa, library, scripture-study

**Files:**
- Create: `lib/scripts/qa.ts`, `lib/scripts/library.ts`, `lib/scripts/scripture-study.ts` (under `apps/web/src/components/chat/`)

Each exports `const script: Script`. Content per spec (authored at implementation, register: GOAL.md examples):
- **qa** entry: prose → scripture block → history block → prose; no actions; fallback = follow-up-flavored prose.
- **library** entry: prose + two `source` blocks (e.g., Ignatius *To the Smyrnaeans* on the Eucharist; Justin Martyr *First Apology* 61 on baptism); actions: *Explain this plainly* → `plain` (prose), *More from this era* → `more` (prose + source).
- **scripture-study** entry (function blocks — cite `c.framework` label in prose): scripture + lexicon (2–3 Greek entries) + prose context; actions: *How has my tradition read this?* → `tradition-reading` (prose + history), *Patristic commentary* → `patristic` (prose + source).

- [x] **Step 1: Write the three scripts.** Structural validity is covered by the Task 8 test; run `bunx tsc --noEmit` here.
- [x] **Step 2: Commit** `feat(chat): scripted flows for Q&A, library, scripture study`

### Task 5: Scripts — devils-advocate, debate-prep

**Files:** Create `lib/scripts/devils-advocate.ts`, `lib/scripts/debate-prep.ts`.

- **devils-advocate** entry (function blocks; name opposing tradition): prose framing + `points` kind "objection" (3 items); actions: *Show my tradition's responses* → `responses` (`points` kind "response") with action *Push the counter-rebuttal* → `counter` (prose + history).
- **debate-prep** entry: prose + `points` kind "objection" with `weight` markers ("Historical frequency: high · weight: heavy" style); actions: *Standard responses from my tradition* → `responses` (`points` kind "response") with actions *Stress-test me (Socratic)* → `socratic` (prose question, `onReply: "socratic-eval"`) and *Export the outline* → `export` (prose: export ships with the Ministry plan); `socratic-eval`: prose evaluation + action *Continue the stress test* → `socratic`.

- [x] **Step 1: Write both scripts; typecheck.**
- [x] **Step 2: Commit** `feat(chat): scripted flows for devil's advocate and debate prep`

### Task 6: Script — comparison (12-tradition dictionary)

**Files:** Create `lib/scripts/comparison.ts`. Test: `lib/scripts/scripts.test.ts` (new).

```ts
export const COMPARISON_ENTRIES: Record<string, { position: string; texts: string; theologians: string }>;
// keyed by framework id, topic: faith & works in salvation — all 12 frameworks
export const script: Script; // entry blocks = (c) => [prose, { type: "comparison", columns: from c.traditions }] ; action: "Historical note on divergence" → history step
```

Example entry (full register expected for all 12):

```ts
reformed: {
  position: "Justification is by faith alone, through the imputed righteousness of Christ; good works are the necessary fruit and evidence of saving faith, never its ground.",
  texts: "Rom 3:28; Eph 2:8–10; Jas 2:14–26 (as evidentiary)",
  theologians: "Calvin, Turretin, Berkhof",
},
```

- [x] **Step 1: Failing test:** every `FRAMEWORKS` id has a `COMPARISON_ENTRIES` entry with non-empty fields; entry blocks for a 3-tradition conversation yield a comparison block with 3 columns whose `tradition` values are the framework labels.
- [x] **Steps 2–4: Verify fail → write all 12 entries + script → pass.**
- [x] **Step 5: Commit** `feat(chat): comparison mode with per-tradition content`

### Task 7: Scripts — catechism (12-document dictionary), resources

**Files:** Create `lib/scripts/catechism.ts`, `lib/scripts/resources.ts`. Test: extend `lib/scripts/scripts.test.ts`.

```ts
export const CATECHISM_ARTICLES: Record<string, { label: string; body: string; proofs?: string[]; explanation: string }>;
// keyed by DOCUMENTS ids; opening/representative article of each document (public domain text)
```

- **catechism** entry (function blocks): `article` block from `c.document` + prose explanation; actions: *Quiz me* → `quiz` (prose question, `onReply: "quiz-eval"`), *Cross-reference the proofs* → `proofs` (prose + scripture); `quiz-eval`: prose evaluation + action *Ask me another* → `quiz`.
- **resources** entry: prose + `resources` block (5 items across the 3 tiers, covenant-theology set per GOAL.md example); actions: *Primary sources only* → `primary` (prose + resources of primary sources), *More scholarly* → `scholarly` (prose + scholarly resources).

- [x] **Step 1: Failing test:** every `DOCUMENTS` id has a `CATECHISM_ARTICLES` entry (non-empty label/body/explanation); catechism entry blocks for `document: "heidelberg"` include an `article` block whose `source` is the Heidelberg label; resources entry includes all three tiers.
- [x] **Steps 2–4: fail → implement all 12 articles + resources script → pass.**
- [x] **Step 5: Commit** `feat(chat): catechism tutor and resource engine flows`

### Task 8: Script registry + seeds

**Files:** Create `lib/scripts/index.ts`. Rewrite `lib/mock-chat.ts`. Extend `lib/scripts/scripts.test.ts`.

```ts
// scripts/index.ts
export function getScript(mode: ModeId): Script;
// mock-chat.ts
export function buildSeeds(): Conversation[]; // one per mode via createConversation + withReply(isFirst)
export const SEED_CONVERSATIONS: Conversation[]; // = buildSeeds()
```

Seed setups: qa Reformed/Reformed Baptist "What does Romans 9 mean for election?"; devils-advocate Reformed vs Arminian on unconditional election; comparison [reformed, arminian-wesleyan, roman-catholic, eastern-orthodox] faith & works; debate-prep Reformed vs Arminian "Regeneration precedes faith"; catechism heidelberg "Walk me through Question 1"; resources Reformed + personal-study "Covenant theology"; library ante-nicene "What did the early church believe about the Eucharist?"; scripture-study Lutheran "1 Peter 3:18–22".

- [x] **Step 1: Failing tests:** for every mode, `getScript` returns a script whose entry exists, whose every `action.next` and `onReply` reference existing steps, and whose fallback is non-empty (walk `steps` recursively); `SEED_CONVERSATIONS` has 8 conversations, one per mode, each ending with an assistant message with ≥1 block.
- [x] **Steps 2–4: fail → implement → pass.** Delete `CANNED_REPLY`/old seeds; update anything importing them.
- [x] **Step 5: Commit** `feat(chat): script registry + one seeded study per mode`

### Task 9: Message blocks renderer

**Files:** Create `components/chat/message-blocks.tsx` + `message-blocks.module.css`.

`export default function MessageBlocks({ blocks }: { blocks: Block[] })` — switch over `block.type`:
- **prose** — Inter body, `--parchment-dim`, 1.7 line-height (match current `assistantBody`).
- **scripture** — gold hairline left rule, Geist Mono uppercase reference line (`--gold`), Fraunces italic passage text.
- **history** — framed block (`--hairline` border, faint gold wash): mono eyebrow `CHURCH HISTORY`, Fraunces heading, Inter body.
- **lexicon** — mono table-like rows: gold term, dim translit in parens, parchment gloss.
- **comparison** — CSS grid `repeat(auto-fit, minmax(180px, 1fr))`, column = hairline-bordered card: mono tradition header (gold), position (Inter), `TEXTS` + `THEOLOGIANS` mono sublabels with dim values; stacks on narrow.
- **points** — numbered cards: gold Fraunces numeral, title (parchment, 600), body (Inter dim), optional mono `weight` marker top-right; `kind="response"` swaps the numeral to a gold `※`-style marker and softens the border.
- **resources** — cards: Fraunces title, mono author, mono uppercase tier chip (gold for scholarly), Inter note.
- **source** — excerpt card: Fraunces italic excerpt with hanging quote, mono citation footer `AUTHOR · WORK · CITATION` in `--stone`/gold.
- **article** — mono `source` eyebrow, Fraunces `label` heading, Inter body, `proofs` as mono chip row.

- [x] **Step 1: Implement component + CSS; typecheck.** (Visual component — no unit tests; verified in Task 13 walkthrough.)
- [x] **Step 2: Commit** `feat(chat): block renderer for structured answers`

### Task 10: Mode picker + setup picker

**Files:** Create `mode-picker.tsx` + `.module.css`, `setup-picker.tsx` + `.module.css`.

```tsx
export default function ModePicker({ mode, onChange }: { mode: ModeId; onChange: (m: ModeId) => void });
// wrapping row of mono uppercase chip buttons; active = gold border + gold text; hairline otherwise
export default function SetupPicker({ mode, setup, onChange }:
  { mode: ModeId; setup: ConversationSetup; onChange: (s: ConversationSetup) => void });
```

`SetupPicker` switches on `getMode(mode).setup`, reusing the existing `FrameworkPicker` chip styling conventions:
- `tradition` — existing `FrameworkPicker` (framework + sub).
- `versus` — `FrameworkPicker` + mono "vs" divider + opposing `<select>` chip (frameworks minus chosen framework).
- `multi-tradition` — add-select chip ("Add tradition…", options exclude selected, hidden at 4) + removable chips (`label ×`) for each selected.
- `document` / `collection` / `tradition-purpose` — select chips over `DOCUMENTS` / `COLLECTIONS` (with "All collections" empty option) / `FrameworkPicker` + purpose select over `PURPOSES`.

Changing mode resets setup (owned by `ChatEmpty`, Task 11). Selects follow `framework-picker.module.css` chip/select/caret pattern.

- [x] **Step 1: Implement both + CSS; typecheck.**
- [x] **Step 2: Commit** `feat(chat): mode picker and per-mode setup controls`

### Task 11: ChatEmpty rewrite

**Files:** Modify `chat-empty.tsx`, `chat-empty.module.css`.

New props: `onStart(input: { mode: ModeId; setup: ConversationSetup; firstMessage: string })`. State: `mode` (default `"qa"`), `setup` (`ConversationSetup`, reset on mode change). Layout: mark → `ModePicker` → headline `{pre}<em>{em}</em>{post}` → lede → composer (`contextFirst`, context = `SetupPicker`, placeholder from mode, disabled unless `isSetupValid`) → sample prompt cards from `getMode(mode).samplePrompts` (disabled unless valid). Keep reveal animation classes; add a `key={mode}` on the swap-content wrapper so copy changes re-reveal.

- [x] **Step 1: Implement; typecheck.**
- [x] **Step 2: Commit** `feat(chat): mode-aware new-study screen`

### Task 12: ChatThread blocks + action chips + header

**Files:** Modify `chat-thread.tsx`, `chat-thread.module.css`.

- New prop: `onAction(action: Action)`.
- Header chip + composer lock chip: `` `${getMode(conversation.mode).label} · ${describeSetup(conversation)}` `` (trim trailing `" · "` when describe is empty).
- Assistant rows render `<MessageBlocks blocks={message.blocks} />` when present, else `content`; copy uses `message.content` (already flattened).
- After the **last** assistant message (and only when `!isReplying`): render `message.actions` as a chip row — mono ghost buttons, gold on hover → `onAction(a)`.

- [x] **Step 1: Implement; typecheck.**
- [x] **Step 2: Commit** `feat(chat): structured answers and follow-up chips in thread`

### Task 13: ChatApp wiring + sidebar marker

**Files:** Modify `chat-app.tsx`, `chat-sidebar.tsx`, `chat-sidebar.module.css` (if needed).

- `handleStart({ mode, setup, firstMessage })` → `createConversation` → `scheduleReply(id, { isFirst: true })`.
- `handleSend(text)` → append user turn → `scheduleReply(id, {})`.
- `handleAction(action)` → append user turn (`action.prefill`) → `scheduleReply(id, { actionNext: action.next })`.
- `scheduleReply(id, opts)`: `setIsReplying(true)`; timeout → `updateConversation(id, (c) => withReply(c, getScript(c.mode), opts))`; `setIsReplying(false)`.
- Sidebar row marker: `` `${getMode(c.mode).label}${describeSetup(c) ? " · " + describeSetup(c) : ""}` ``, ellipsized.

- [x] **Step 1: Implement; run full test suite + typecheck.**
- [x] **Step 2: Manual walkthrough** (`bun run dev`, port 3001): each of the 8 modes — pick, validate gating, send, verify entry blocks render, click every action chip, type into `onReply` steps (quiz, Socratic), check fallback reply, sidebar markers, seeds, header chips, reduced-motion sanity.
- [x] **Step 3: Commit** `feat(chat): wire multi-mode flows through ChatApp`

### Task 14: Final verification

- [x] **Step 1:** `bun run test` (all green), `bunx tsc --noEmit`, `bun run build` in `apps/web`.
- [x] **Step 2:** Re-read spec; confirm every section maps to shipped code; fix gaps.
- [x] **Step 3: Commit any fixes** `chore(chat): final verification fixes for multi-mode surface`

# Design: `/chat` — All GOAL.md features as chat modes (UI shells, mock-driven)

**Date:** 2026-07-01
**Status:** Approved (user delegated remaining decisions)
**Scope:** Extends the v1 `/chat` shell so every GOAL.md feature has a designed, interactive surface driven by mock data. No Convex persistence, no AI — same fidelity contract as the v1 shell.

---

## Decisions (from brainstorming)

- **Fidelity:** UI shells with mocks for all features. Real AI + persistence come later.
- **Architecture:** *Everything is a chat mode.* All features live in the one `/chat` surface as selectable modes — including the Catechism Tutor and Patristic Library, which embed document content in conversation.
- **Mock depth:** Scripted multi-step flows. Follow-up buttons work and play out each mode's signature workflow with pre-written content (Debate Prep walks thesis → objections → responses → Socratic loop; the Tutor runs a scripted quiz; Devil's Advocate offers "show my tradition's responses").
- Remaining design decisions delegated to Claude.

## The eight modes

GOAL.md features map to modes as follows. Church History Surfacing (feature #2) is not a mode — it is a `history` content block woven into answers across modes, exactly as GOAL.md describes ("not a sidebar; part of the answer itself").

| Mode id | GOAL.md feature | Setup controls | First message is… |
|---|---|---|---|
| `qa` | #1 Framework Q&A | tradition + optional sub-tradition | the question |
| `devils-advocate` | #3 Devil's Advocate | your tradition (+sub) + opposing tradition | doctrine/passage to test |
| `comparison` | #4 Tradition Comparison | 2–4 traditions (multi-select) | passage/doctrine/question |
| `debate-prep` | #5 Debate Prep | your tradition (+sub) + opposing tradition | the thesis you defend |
| `catechism` | #6 Catechism Tutor | confessional document (12 from GOAL.md) | question about the document |
| `resources` | #7 Resource Engine | tradition (+sub) + purpose (debate/sermon/personal/academic) | the topic |
| `library` | #8 Patristic Library | optional collection filter (6 collections) | the search/query |
| `scripture-study` | #9 Scripture Study | tradition + optional sub-tradition | the passage |

`qa` remains the default mode. The mode is chosen on the new-chat screen via a mode selector; like the framework, it is **locked once the conversation starts**.

## UI structure

**Mode selector (`mode-picker.tsx`)** — a wrapping row of Geist Mono uppercase chips above the headline on the new-chat screen. Active chip gold. Selecting a mode swaps the headline (`Fraunces` with `<em>` accent word), lede, composer placeholder, setup controls, and sample-prompt cards.

**Setup controls (`setup-picker.tsx`)** — rendered in the composer's context row (same chip language as the existing `FrameworkPicker`, which is reused for tradition + sub-tradition). New chip controls: opposing-tradition select, comparison multi-select (select adds a tradition chip, clicking a chip removes it; min 2, max 4), document select, purpose select, collection select. Send is gated per mode's validity rule.

**Thread** — header chip now shows `mode · tradition(s)` (e.g. `DEVIL'S ADVOCATE · Reformed vs Arminian`). The locked chip in the composer matches.

**Sidebar** — each row's marker line becomes `mode · framework` so mixed-mode history scans well. Seeds: one conversation per mode (8 total), each seeded with its script's opening exchange so every answer format is browsable on first load.

## Content blocks

Assistant messages become a list of typed blocks (`Message.blocks`), rendered by a new `message-blocks.tsx` (+ module CSS). User messages keep plain `content`. The copy button flattens blocks to text.

```ts
type Block =
  | { type: "prose"; text: string }
  | { type: "scripture"; reference: string; text: string }        // hairline-ruled, mono reference, serif italic text
  | { type: "history"; heading: string; text: string }            // "CHURCH HISTORY" gold mono eyebrow, framed
  | { type: "lexicon"; entries: { term: string; translit: string; gloss: string }[] }  // Greek/Hebrew notes
  | { type: "comparison"; columns: { tradition: string; position: string; texts: string; theologians: string }[] }
  | { type: "points"; kind: "objection" | "response"; items: { title: string; body: string; weight?: string }[] }
  | { type: "resources"; items: { title: string; author: string; tier: "introductory" | "intermediate" | "scholarly"; note: string }[] }
  | { type: "source"; work: string; author: string; citation: string; excerpt: string }  // patristic excerpt card
  | { type: "article"; source: string; label: string; body: string; proofs?: string[] }; // confession/catechism article
```

All block styling follows `docs/DESIGN.md`: parchment text, hairline rules, 2px radii, gold used sparingly (eyebrows, rank markers, active states), Geist Mono for the apparatus (references, citations, tiers, weights), Fraunces for display moments (article headings, source works).

## Scripted flows

Each mode has a **script**: a map of step id → `{ blocks, actions?, onReply? }` in `lib/scripts/<mode>.ts`.

- `actions` — follow-up chips rendered under the assistant message (`Message.actions`), active only on the last message while not replying. Clicking one appends its `prefill` text as a user message and replies with the step named by its `next`.
- `onReply` — step id to use for the next *typed* message (covers the Tutor quiz answer and Debate Prep's Socratic answers). If a typed message arrives with no `onReply` pending, the mode's fallback reply is used (a mode-flavored version of the v1 canned reply).
- The entry step may be **parameterized by setup**: comparison builds its columns from the selected traditions (a per-tradition content dictionary on "faith and works in salvation", covering all 12 frameworks); catechism serves the opening article of the selected document (a per-document dictionary covering all 12 GOAL.md documents).

Signature flows:

- **Devil's Advocate:** objections from the opposing tradition → chip: *Show my tradition's responses* → responses → chip: *Push the counter-rebuttal* → deeper round + history block.
- **Debate Prep:** ranked objections (with weight markers) → *Standard responses* → *Stress-test me (Socratic)* → assistant asks; typed answer gets a scripted evaluation → *Export outline* returns a note that export ships with the Ministry plan.
- **Catechism Tutor:** opening article + explanation → *Quiz me* → scripted question; typed answer gets scripted evaluation → *Cross-reference the proofs*.
- **Comparison:** columns for the chosen traditions → *Historical note on divergence* → history block.
- **Library:** two source excerpts → *Explain this plainly* / *More from this era*.
- **Scripture Study:** scripture + lexicon + context prose → *How has my tradition read this?* → *Patristic commentary* (source block).
- **Resources:** tiered book cards → *Primary sources only* / *More scholarly*.
- **Q&A:** upgraded single rich answer (prose + scripture + history blocks) replacing the v1 plain canned reply.

## State model (`lib/chat-state.ts`)

```ts
interface Message { id; role; content: string; blocks?: Block[]; actions?: Action[] }
interface Conversation {
  id; title; mode: ModeId;
  framework?; subTradition?; opposing?;      // qa / devils-advocate / debate-prep / scripture-study / resources
  traditions?: string[];                      // comparison
  document?; purpose?; collection?;           // catechism / resources / library
  messages: Message[];
  nextTypedStep?: string;                     // set by a step's onReply
}
```

Pure, unit-tested helpers: `createConversation` (now takes mode + setup), `appendMessage` (blocks + actions), `replyFor(conversation, { actionNext? })` → resolves the script step (entry / action target / onReply / fallback) and returns the reply message parts plus the new `nextTypedStep`. `ChatApp` stays the single stateful owner; the fake reply delay and typing indicator are unchanged.

## Files

- **New lib:** `lib/modes.ts` (mode definitions: label, headline, lede, placeholder, sample prompts, setup kind + validity), `lib/scripts/{qa,devils-advocate,comparison,debate-prep,catechism,library,resources,scripture-study}.ts` + `lib/scripts/index.ts`, block types in `lib/chat-state.ts`.
- **New components:** `mode-picker.tsx`, `setup-picker.tsx`, `message-blocks.tsx` (+ module CSS each).
- **Edited:** `chat-empty.tsx` (mode selector + per-mode copy/setup/prompts), `chat-thread.tsx` (block rendering, action chips, header chip), `chat-sidebar.tsx` (mode marker), `chat-app.tsx` (mode-aware start/send/action handlers), `lib/mock-chat.ts` (seeds rebuilt from scripts).

## Testing

Extend the existing Vitest suite (pure logic only, as v1):

- `chat-state`: `createConversation` per mode, `replyFor` resolution order (action target > onReply > fallback), immutability.
- `scripts`: every mode has an entry step; every action `next` and `onReply` references an existing step; comparison dictionary covers all 12 framework ids; catechism dictionary covers all 12 documents.
- Manual: run `next dev` (port 3001) and walk each mode's flow end to end.

## Out of scope

Convex persistence, Claude streaming, real framework system prompts, RAG, export files, payments gating, mobile app. State remains in-memory and resets on reload.

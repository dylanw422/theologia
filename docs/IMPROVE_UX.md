# Theologia — UX Improvements

Prioritized against the current state of the app (the `/chat` multi-mode mock surface, 2026-07-01) and the product vision in `docs/GOAL.md`. Each item names the problem as it exists in the code today, the improvement, and why it serves the GOAL.md audience — serious students who will spend long sessions here.

Items marked **(pre-AI)** are worth doing now, in the mock shell. Items marked **(with AI slice)** should be designed now but land with persistence/streaming, so we don't build throwaway plumbing.

---

## Tier 1 — Highest impact

### 1. A home tradition, chosen once **(pre-AI)**

**Problem:** Every new study starts with an empty setup — users re-select their tradition from scratch each time, in every mode. GOAL.md's whole premise is that a user *has* a tradition ("when a user selects their theological framework, the AI engages from within that tradition"); the UI currently treats it as a per-conversation whim. Worse, switching modes on the new-study screen resets the setup entirely (`ChatEmpty.handleModeChange`), so picking Q&A → Reformed, then tabbing to Devil's Advocate, throws your tradition away.

**Improvement:** A profile-level home tradition (framework + sub-tradition), set during onboarding and editable in the user menu. Every mode's setup pre-fills from it; per-conversation overrides remain possible. Mode switches on the new-study screen carry the framework fields across instead of resetting.

**Why:** This is the single most repeated interaction in the app, and it's also identity — a Reformed Baptist shouldn't have to re-assert being one forty times a week. Pre-filling also makes the sample-prompt cards instantly clickable, collapsing time-to-first-answer from four interactions to one.

### 2. Mobile has no sidebar at all **(pre-AI)**

**Problem:** At ≤760px the sidebar is `display: none` with no toggle (`chat-app.module.css`). On a phone there is no way to reach past studies, start a new study, or access the user menu — the app is effectively single-conversation and sign-out-proof on mobile.

**Improvement:** A slide-over sidebar behind a hamburger in the thread header / empty-state header, with the same content as desktop. Fresco-native: the panel slides from the left over a darkened scrim, hairline edge, reduced-motion guarded.

**Why:** Pastors and seminary students live on their phones between meetings; GOAL.md ships a mobile app in Phase 3, but the responsive web is the mobile experience until then.

### 3. Make "what's missing?" visible in setup gating **(pre-AI)**

**Problem:** Until the setup is valid, the composer is disabled with the generic placeholder "Complete the setup to begin…" and the sample cards are dimmed. Nothing says *which* control is incomplete — Comparison needs 2–4 traditions, Debate Prep needs an opposing tradition, and the user is left to deduce that from chip states.

**Improvement:** Replace the generic placeholder with a specific one per missing field ("Choose your tradition…", "Add at least one more tradition…", "Choose the tradition you'll face…"). Give the offending chip a soft gold pulse (motion-guarded) on attempted send.

**Why:** Setup is the front door of all eight features. GOAL.md's audience will tolerate depth; nobody tolerates a form that won't say what it wants.

### 4. Per-conversation reply state **(pre-AI, load-bearing for streaming)**

**Problem:** `isReplying` is a single app-level boolean in `ChatApp`. Switch conversations during the 900 ms reply window and the typing indicator renders in the *wrong* thread, and every thread's composer is disabled. Harmless at 900 ms; broken behavior once real Claude responses take 20–60 seconds.

**Improvement:** Track pending replies per conversation id (e.g., a `Set<string>` of replying ids). The typing indicator and composer lock apply only to the conversation that is actually waiting; other threads stay fully usable.

**Why:** With streaming, users *will* start a Debate Prep in one thread while a Scripture Study generates in another — that's the multi-study workflow GOAL.md sells. Fixing it now is a ten-line change; fixing it after streaming is a refactor.

### 5. Streaming answers with block-aware progressive render **(with AI slice)**

**Problem:** Answers currently appear whole after a fake delay. Real tradition-aware answers will be long (the mock exemplars are already 400–700 words) — a 30-second blank wait kills the experience.

**Improvement:** Stream prose blocks token-by-token; render structured blocks (comparison columns, objection cards, articles) as complete units as they arrive, with a subtle hairline shimmer placeholder for the block being generated. Keep the "Theologia" head and typing indicator as the pre-first-token state.

**Why:** The scripted-block architecture (`Block[]` messages) was built for exactly this — the renderer already treats a message as a sequence of typed units. Streaming per-block preserves the manuscript feel (no half-rendered tables) while giving immediate feedback.

---

## Tier 2 — Strong wins

### 6. Sidebar: search, grouping, rename, delete **(pre-AI shell; persistence makes it real)**

**Problem:** The sidebar is a flat, append-only list. No search, no way to rename the auto-derived titles (truncated first messages like "Test unconditional election against Romans 9."), no delete, no grouping. With persistence this becomes a wall of near-identical gold text within a week of real use.

**Improvement:** (a) a filter-as-you-type field under "Studies"; (b) group headers by mode or by recency (Today / This week / Earlier); (c) hover actions per row: rename, delete (with confirm); (d) let the first assistant reply title the conversation once real AI lands (models title better than truncation).

**Why:** GOAL.md's user runs *studies*, plural, over months — sermon prep alongside a catechism read-through alongside debate prep. Retrieval of past work is the product's memory.

### 7. Show the workflow, not just the chips **(pre-AI)**

**Problem:** The multi-step modes (Debate Prep, Devil's Advocate, Catechism quiz) are genuinely staged — objections → responses → Socratic loop — but the UI presents each stage as ephemeral chips under the newest message. Users can't see where they are in the workflow, what's been covered, or what remains; once they type anything, the chips vanish and the path is invisible.

**Improvement:** A slim mono "stage rail" in the thread header for staged modes (e.g., `OBJECTIONS ✓ · RESPONSES ✓ · STRESS-TEST ●`), driven by which script steps have been visited. Keep chips as the *action*; the rail is the *map*. Also render past chips in a quiet "explored" state instead of removing them, so the transcript reads as a complete record.

**Why:** GOAL.md pitches Debate Prep as "a structured workflow" and the Tutor as a course of study. Structure the user can't see is structure they won't trust — and the exported outline (see #12) needs this state anyway.

### 8. Collapsible apparatus blocks **(pre-AI)**

**Problem:** Rich answers stack prose + scripture + history + lexicon + sources into tall columns. The church-history block in particular — a deliberate GOAL.md feature — adds 120+ words to answers whether or not the reader wants it *right now*. Long threads become scroll marathons.

**Improvement:** Make `history`, `lexicon`, and `source` blocks collapsible: header always visible (eyebrow + heading), body folds. Default open on first appearance, remember the user's per-type preference. A thin "collapse all apparatus" toggle in the thread header for reading-focus.

**Why:** "Surfacing history as woven-in context" (GOAL.md #2) works when it's glanceable and expandable — not when it's mandatory reading between the user and their next question.

### 9. Gentle autoscroll + scroll-to-bottom affordance **(pre-AI)**

**Problem:** `ChatThread` hard-jumps `scrollTop = scrollHeight` on every message count change. If you've scrolled up to re-read an objection card while the reply lands, you're yanked to the bottom — the exact reading-heavy behavior this app invites. The design spec's original `MessageScroller` primitive (autoscroll only when already at bottom + a scroll-to-bottom button) was dropped in the v1 implementation.

**Improvement:** Only autoscroll when the user is already within ~120px of the bottom; otherwise show a small gold ↓ pill ("New response") that scrolls on click. Reuse `packages/ui`'s `MessageScroller` if it fits, or a 20-line hook if it doesn't.

**Why:** Answers are documents here, not chat bubbles. Respecting the reader's scroll position is table stakes for a study tool.

### 10. First-run onboarding instead of eight mystery seeds **(pre-AI framing, ships with persistence)**

**Problem:** New users land with eight pre-populated conversations they never had. Great for demos; disorienting for a real account ("who asked these?"). And nothing ever explains what the eight modes *are* — the labels ("Devil's Advocate", "Comparison") carry all the weight.

**Improvement:** (a) Replace seeds with a two-step onboarding: choose your home tradition (see #1), then a mode gallery — the same eight chips, each with its lede and one example card, marked "examples" — that creates a study only when the user acts. (b) Keep the seeds behind a "Show me around" / demo affordance rather than deleting the work; they're the best feature tour we have. (c) One-line mode descriptions as tooltips/subtext on the picker chips permanently.

**Why:** GOAL.md's free tier exists to convert curious visitors; the first sixty seconds decide whether they see "framework-aware research environment" or "confusing chat app with religious words."

---

## Tier 3 — Sharpening

### 11. Message-level actions: regenerate, edit, quote **(with AI slice)**

Once answers are real: regenerate the last reply, edit-and-resend a user turn, and — uniquely valuable here — **quote a block into the composer** (select an objection card or scripture block → "ask about this"). The block model makes quote-targeting natural, and it turns long answers into navigable starting points rather than dead ends. GOAL.md's Socratic flows depend on this kind of grounded follow-up.

### 12. Real export for Debate Prep and Catechism **(Ministry tier feature)**

The `export` script step currently returns a "ships with the Ministry plan" note. When built, export should assemble from the conversation's visited script steps (see #7): thesis, ranked objections, responses, stress-test Q&A — as Markdown and PDF, in the manuscript visual language. This is a paid-tier conversion moment per GOAL.md's pricing table; the artifact should be good enough to hand out at a study group.

### 13. Library needs browse, not just search **(Phase 2+)**

GOAL.md #8 promises "users can browse directly" — a library has shelves. The current library mode is query-only. Add a browse entry point (collections → authors → works) as a panel or a scripted "table of contents" reply per collection. Even in mock form, a browsable shelf communicates the depth of the corpus better than an empty composer.

### 14. Keyboard and command affordances **(pre-AI)**

- `Cmd/Ctrl+K`: study switcher (fuzzy search over titles + modes) — pairs with #6.
- `Cmd/Ctrl+N` or `/` from anywhere: new study.
- Arrow-key navigation on the mode picker (it's `role=tab` but only click-navigable today; this is also an a11y gap).
- `Esc` collapses an open apparatus block (#8).

### 15. Empty-composer hints per stage **(pre-AI)**

In `onReply` stages (quiz answers, Socratic answers) the composer placeholder still says "Ask a question…" — but the app is *waiting for an answer, not a question*. Thread the pending step into a stage-aware placeholder ("Type your answer — I'll check it against the text…"). Small, and it makes the tutor feel like a tutor.

### 16. Trust markers for the mock → real transition **(now, then remove)**

Every scripted reply quietly presents itself as a real answer; only the fallback admits "this is a preview." Until the AI slice lands, add a small mono `PREVIEW` marker to the assistant head so no one mistakes canned exemplars for tradition-tailored answers. GOAL.md stakes the product on intellectual honesty — the UI should practice it about itself. Remove the marker when answers are real; replace it with source/confession citations (which the `Block` model already has room for).

---

## Sequencing note

Do #4 (per-conversation reply state) and #9 (scroll behavior) before the streaming slice — both are small now and structural later. #1, #3, #6a, #15, #16 are low-effort/high-visibility and can ship as one "polish" pass on the current mock. #5, #10, #11 belong to the persistence + AI slice by design.

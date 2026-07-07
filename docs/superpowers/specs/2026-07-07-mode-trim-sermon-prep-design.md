# Mode Trim, Sermon Prep Mode, and Mode Info Modal

Date: 2026-07-07
Status: approved trim set (cut Debate Prep + Resources); design pending final review

## Goal

Reduce the eight study modes to a tighter, non-redundant set, add a Sermon
Prep mode for pastors, and give users an in-app explanation of what each
mode is for via an info icon + modal next to the mode picker.

## Mode lineup

Active modes after this change (picker order):

1. **Q&A** — unchanged, plus a prompt note that it can recommend reading
   (via the `<resources>` tag) when asked, absorbing the Resources use case.
2. **Devil's Advocate** — absorbs Debate Prep. Same `versus` setup. The
   merged prompt argues the rival tradition's strongest case AND drills the
   user: ranked objections as `<points kind="objection">` with weight
   attributes, best responses as `<points kind="response">`, and candid
   assessment when the user answers in their own words. Lede updated to
   mention drilling.
3. **Comparison** — unchanged.
4. **Catechism** — unchanged.
5. **Library** — unchanged.
6. **Scripture Study** — unchanged.
7. **Sermon Prep** — new (see below).

Removed from the picker: **Debate Prep** (merged into Devil's Advocate),
**Resources** (folded into Q&A; the `<resources>` tag already works in
every mode).

## Sermon Prep mode

- `id: "sermon-prep"`, label "Sermon Prep".
- Setup kind: `tradition` (framework + optional sub-tradition), same as
  Q&A/Scripture Study.
- Empty-screen copy (final wording at implementation, this register):
  - heading: "Prepare to *preach* the text."
  - lede: bring Sunday's passage or theme; exegesis, context, the
    tradition's reading, and the church's voice on the text — the study
    behind the sermon.
  - placeholder: "Enter your sermon passage or theme…"
  - Three sample prompts (passage, theme, series).
- Backend prompt section (`MODE_SECTIONS["sermon-prep"]`): the user is
  preparing to preach within their tradition. Surface what a faithful
  expositor needs: the passage quoted in `<scripture>`, original-language
  notes in `<lexicon>` where vocabulary matters, historical and literary
  context, the tradition's confessional/doctrinal reading, the Fathers and
  later interpreters via `<source>`, church-history material usable as
  sermon illustrations (`<history>`), cross-references, common misreadings
  to avoid, and pastoral application angles. It equips the preacher rather
  than writing the sermon; it may suggest outline directions when asked.
- Added to `vMode` (schema), `ModeId`, `MODE_SETUP` ("tradition"), and
  `isSetupValid` (covered by the existing "tradition" branch).

## Legacy handling (live conversations exist)

No migration. Old conversations keep working with their original behavior:

- **Backend**: `vMode`, `ModeId`, `MODE_SETUP`, and `MODE_SECTIONS` retain
  `debate-prep` and `resources` entries, so existing threads keep their
  exact prompts, setup validation, and schema validity. A comment marks
  them legacy (not offered in the UI).
- **Frontend**: the `MODES` array lists only the seven active modes.
  `getMode()` gains a legacy alias map — `debate-prep → devils-advocate`,
  `resources → qa` — so old threads still render a header, placeholder,
  and composer copy instead of throwing. `describeSetup()` keys off the
  aliased mode's setup kind: legacy debate-prep (versus) renders under
  devils-advocate's versus case unchanged; legacy resources conversations
  render as their framework label (the purpose suffix is dropped — an
  acceptable cosmetic change for old threads).
- The `tradition-purpose` setup kind, `PURPOSES`, and the setup-picker
  branch for it remain in code for legacy type-completeness; they are
  simply unreachable for new conversations.

## Mode info modal

- **Data**: `Mode` gains `useCases: string[]` — two or three short,
  concrete "use this when…" lines per active mode (e.g. Q&A: "Quick
  doctrine checks — 'what does my church teach about X?'"; Sermon Prep:
  "You're preaching Sunday and need the study behind the text").
- **Trigger**: a small info icon button (accessible label "About the study
  modes") rendered at the end of the mode-picker chip row in
  `mode-picker.tsx`.
- **Modal**: new `mode-info-dialog.tsx` + `mode-info-dialog.module.css` in
  `apps/web/src/components/chat/`, built on `@base-ui/react` Dialog
  (consistent with the ChipSelect-on-Base-UI pattern). Content: title
  ("What each mode is for"), then one row per active mode — label, its
  lede as the one-line summary, and its use-case lines. Dismiss via
  backdrop click, Escape, and a close button. Styled with the app's
  existing CSS-module conventions.

## Testing

- `modes.test.ts`: seven active modes, unique ids, full copy including
  `useCases`; `getMode` resolves legacy ids via aliases; `describeSetup`
  for a legacy resources conversation returns the framework label.
- `prompts.test.ts`: sermon-prep section mentions preaching/illustrations;
  merged devils-advocate section covers both objection ranking and
  drilling; legacy `debate-prep`/`resources` sections still build.
- No schema migration tests needed (validator only widens).

## Out of scope

- Removing legacy mode data or running a data migration.
- Any change to billing/usage metering (mode is not priced).
- Sermon manuscript/outline generation as a first-class feature.

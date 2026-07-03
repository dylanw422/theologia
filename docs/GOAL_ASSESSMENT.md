# State of the App vs. GOAL.md

_Assessment date: 2026-07-03_

**Bottom line:** measured against Phase 1 of the roadmap, the app is close — the chat
surface arguably overshoots by including Phase 2 modes — but the real primary-source
library and any enforcement of the pricing model are the two substantive things standing
between the current state and what GOAL.md describes.

## What the app already delivers

- **All nine features exist as chat modes.** Q&A, Devil's Advocate, Comparison, Debate
  Prep, Catechism Tutor, Resources, Library, and Scripture Study are each a real mode with
  its own setup flow and a dedicated system prompt in
  `packages/backend/convex/lib/prompts.ts`. Church History Surfacing is handled the way
  GOAL.md describes — woven into answers via the `<history>` tag rather than as a separate
  feature.
- **The framework catalog matches the spec.** All 12 traditions with their sub-traditions,
  the 12 confessional documents, the 6 library collections, and the 4 study purposes in
  `studyData.ts` line up with GOAL.md's tables, including Oneness Pentecostalism treated
  as a first-class framework.
- **Live end-to-end chat works.** Conversations persist in Convex, replies stream
  word-by-word from the Anthropic API via the agent component, setup is validated
  server-side, and auth gates every query and mutation.
- **The landing page** has the pricing tiers and a working waitlist.

## Where it falls short of GOAL.md

1. **The Patristic Library isn't a library.** GOAL.md specifies a searchable corpus of
   public-domain primary texts with RAG over Convex vector search. There is no ingested
   text, no embeddings, and no vector search anywhere in the backend — Library mode is a
   system prompt asking the model to quote the Fathers from memory, which also sits in
   tension with GOAL's accuracy commitments. Same issue for the Catechism Tutor: no actual
   confessional texts are stored; it relies on model recall. This is the biggest gap, and
   it's part of Phase 1 ("basic Patristic Library").

2. **Pricing exists on paper only.** The usage meter renders `MOCK_USAGE` (a hardcoded
   Scholar plan), there is no server-side metering, and nothing gates features by tier —
   Free users can use Ministry-only modes like Debate Prep and Scripture Study. The Polar
   integration (`polar.ts`) exposes checkout/subscription functions but nothing connects a
   subscription to feature access or limits.

3. **No export tools.** Debate Prep's "export the full outline as a structured document"
   and the Ministry tier's export tools don't exist.

4. **Stack deviations from the doc.** GOAL.md says Clerk, Stripe, and `claude-sonnet-5`;
   the app uses Better Auth, Polar, and `claude-sonnet-4-6` (`chat.ts`). If these are
   deliberate choices, GOAL.md's Technical Architecture section is stale and worth
   updating.

5. **Mock seed conversations still ship.** The sidebar mixes hardcoded scripted threads
   from `mock-chat.ts` with real ones — fine for development, not for the stated product.

6. **Phase 3+ items** (mobile app, Church Team seats/shared notes, Greek/Hebrew lexicon
   integration) are absent, which is consistent with the roadmap rather than a shortfall.

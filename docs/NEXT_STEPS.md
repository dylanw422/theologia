# Theologia — Next Steps

What's still missing or unfinished, grouped by area. Billing/metering shipped 2026-07-05 (spec: `superpowers/specs/2026-07-04-polar-billing-usage-design.md`); this list is what comes after. Biggest-impact items first within each section.

## Product gaps (vs GOAL.md)

- [ ] **Primary-source library.** The largest remaining gap. No ingested texts, no embeddings, no vector search — Library, Catechism, and Scripture Study modes run on model recall alone. Needs: corpus selection (patristics, confessions, catechisms), ingestion + chunking pipeline, Convex vector search, and RAG wiring into `streamReply`. Batch API (50% off) is the intended tool for embedding runs (see PRICING.md → Cost Levers).
- [ ] **Mode gating by tier.** Deliberately deferred from the billing slice. Free users can currently open every mode (Debate Prep, Scripture Study, …) with full system prompts; the pricing page implies Free = Framework Q&A only, Scholar adds Devil's Advocate/Comparison/Resources, Ministry adds the rest. Needs plan-aware mode picker UI + backend rejection in `createConversation`.
- [ ] **Export tools.** Promised on the Ministry tier ("Export"), not built at all.

## Billing & plans

- [ ] **Confirm checkout end-to-end in sandbox.** Everything else is verified; the last untested loop is: Scholar checkout with the test card → `subscription.created` webhook → meter flips to "Weekly usage · Scholar plan" → banner disappears → "Manage Subscription" appears.
- [ ] **Prompt caching.** PRICING.md's ~$0.04/query cost model assumes framework prompts are cached (cache reads at ~0.1×), but the chat pipeline sends no `cache_control` breakpoints. Cheap now; matters as framework prompts and RAG context grow. After adding, verify `cache_read_input_tokens` is nonzero and confirm the `usageHandler` token-extraction assumption (whether AI SDK's `inputTokens` includes cache tokens — moot today because cache counts are zero).
- [ ] **Church Team seat pooling.** No seat/team system exists; the subscription owner meters individually. Pooled usage across 5 seats is load-bearing for that tier's economics (PRICING.md).
- [ ] **Production Polar cutover.** Everything currently targets the sandbox org. Needs: production products created in Polar, prod env vars on the prod Convex deployment (`POLAR_ORGANIZATION_TOKEN` = `POLAR_PROD_API`, `POLAR_SERVER=production`, three `POLAR_PRODUCT_*` IDs), a production webhook at `<prod>.convex.site/polar/events`, and one `polar:syncProductsInternal` run.
- [ ] **Blocked-send UX decision.** Spec called for an inline notice with an upgrade link in the composer; shipped behavior is a plan-specific toast plus the persistent upgrade links in the meter's at-limit state and the free banner. Accept or build the inline version.

## Small polish (from code-review backlog)

- [ ] Thread `planId` through `streamReply`'s scheduler args instead of re-resolving the plan in both the send mutation and the action (removes a duplicate subscription lookup and a benign TOCTOU window).
- [ ] Meter aria-label: "5 of 20 used" reads better than "5 / 20 used" for screen readers.
- [ ] Meter bar fill uses the rounded percent; the ring uses the exact fraction (≤0.5% visual mismatch).
- [ ] `@convex-dev/polar/react` import sits in the wrong import group in `user-menu.tsx`.
- [ ] Test coverage gaps (component-heavy, logged consciously): enforcement through the actual chat mutations, per-plan model selection in `streamReply`, and `getUsage`'s discriminated shape are untested; only the underlying pure logic and the extracted helper are covered.

## Infrastructure

- [ ] **Next.js dev-server memory leak.** Instrumentation leak in `next dev` (present on 16.2.9/16.2.10/16.3.0-preview.5, no released fix as of 2026-07-02) — restart the dev server periodically; watch vercel/next.js#91396. A Node upgrade from 24.3.0 may also be relevant.
- [ ] **Monitor Sonnet 5 intro-pricing expiry (2026-08-31).** Limits are already sized on standard $3/$15 rates, so nothing breaks — just don't tune limits against intro-period margins.

## Operational notes (not tasks)

- Polar sandbox gotcha: deleting a customer in the Polar dashboard strands the mapping row in the polar component's `customers` table → "Customer does not exist" on checkout. Delete the row (Convex dashboard → `polar` component → `customers`); the next checkout self-heals by email lookup.
- `bunx convex run polar:syncProductsInternal` syncs products from the CLI (the public `syncProducts` action requires an app login).

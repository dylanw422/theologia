# Polar Billing + Usage Metering — Design

**Date:** 2026-07-04
**Status:** Approved pending spec review
**Scope:** Connect Polar subscriptions to real checkout/plan state, meter API usage per user per week, enforce weekly caps for all tiers, and reflect usage truthfully on the chat page. Mode gating by tier is **out of scope** (later slice).

## Context

- `packages/backend/convex/polar.ts` already has the Polar client, `polar.api()` exports, `getCurrentSubscription`, `syncProducts`, and webhook routes in `http.ts`. No product key mapping is configured and no Convex env vars are set yet.
- The chat usage meter (`apps/web/src/components/chat/chat-usage-meter.tsx`) renders hardcoded `MOCK_USAGE`.
- `docs/PRICING.md` is the source of truth for the cost model: usage is metered as **dollars of API cost** against a **weekly budget** (monthly API budget ÷ 4), users see only a percentage and a reset countdown.
- Sandbox Polar products exist: Scholar ($19/mo), Ministry ($39/mo), Church Team ($99/mo). Free = no subscription.

## Decisions

1. **Metering approach:** aggregate weekly row (Approach A). One `usageWeeks` document per `(userId, weekStart)`, accumulated by the agent's usage handler. O(1) reads for the meter and enforcement. Raw token totals accumulate on the same row for debugging.
2. **Enforcement:** hard cap at 100% of the weekly budget for **all** tiers, including paid. Over-cap sends fail with a typed error; the UI tells paid users to upgrade or wait for the reset. No unlimited overage, no Haiku downgrade for over-cap paid users.
3. **Model routing by tier:** free users run on `claude-haiku-4-5`; all paid tiers run on `claude-sonnet-5`. (Verified live 2026-07-04: Sonnet 5 is $3/$15 per MTok standard, $2/$10 intro through 2026-08-31; Haiku 4.5 is $1/$5.)
4. **Metering rates:** standard (non-intro) pricing, matching PRICING.md's sizing. Cache read 0.1× input rate, cache write 1.25×.
5. **Week boundary:** Monday 00:00 **UTC** (PRICING.md says "local"; the server needs one deterministic boundary — the UI countdown uses the same UTC reset).

## Plans

Canonical plan table in `packages/backend/convex/lib/plans.ts`:

| planId       | productKey (Polar) | label       | model             | weeklyBudgetUsd |
| ------------ | ------------------ | ----------- | ----------------- | --------------- |
| `free`       | — (no sub)         | Free        | claude-haiku-4-5  | 0.075           |
| `scholar`    | `scholar`          | Scholar     | claude-sonnet-5   | 1.375           |
| `ministry`   | `ministry`         | Ministry    | claude-sonnet-5   | 2.825           |
| `churchTeam` | `churchTeam`       | Church Team | claude-sonnet-5   | 7.20            |

- Paid budgets = monthly API budget from PRICING.md ÷ 4 ($5.50, $11.30, $28.80).
- **Free budget changes from PRICING.md's $0.20** to $0.075: free now runs Haiku (~$0.015/query), and 20 queries/month × $0.015 ÷ 4 ≈ $0.075/week. Keeps the "20 queries/month" promise accurate. PRICING.md gets a follow-up edit reflecting free-on-Haiku (this also cuts free-tier worst-case cost to ~$0.30/user/month).
- Church Team pooling across seats is out of scope for this slice; the subscription owner's usage is metered individually for now (noted as a known limitation until team seats exist).

## Backend

### Polar client (`polar.ts`)

- Configure `products` in the `Polar` constructor from Convex env vars:
  `POLAR_PRODUCT_SCHOLAR`, `POLAR_PRODUCT_MINISTRY`, `POLAR_PRODUCT_CHURCH_TEAM`.
- `getCurrentSubscription().productKey` → plan via `plans.ts`; null subscription → `free`.

### Schema

```
usageWeeks: {
  userId: string,
  weekStart: number,          // ms epoch of Monday 00:00 UTC
  microUsd: number,           // accumulated cost in millionths of a dollar
  inputTokens: number,
  outputTokens: number,
  cacheReadTokens: number,
  cacheWriteTokens: number,
}  index by_user_week on [userId, weekStart]
```

Micro-USD integers avoid float drift on repeated accumulation.

### Metering (`usage.ts`)

- `usageHandler` on `theologiaAgent` (fires after each generation with userId, model, token usage incl. provider cache metadata) → internal mutation `recordUsage` that computes micro-USD from a per-model rate table (`claude-sonnet-5`: 3/15, `claude-haiku-4-5`: 1/5 per MTok; cache read 0.1×, cache write 1.25× the input rate) and upserts the `(userId, weekStart)` row.
- Unknown model IDs meter at the Sonnet 5 rate (fail conservative) and log a warning.
- `getUsage` query (auth required): returns `{ planId, planLabel, weeklyBudgetUsd, usedUsd, resetsAt }`. Plan resolved via `getCurrentSubscription`.

### Enforcement (`chat.ts`)

- `createConversation` and `sendMessage`: resolve plan + current week usage; if `usedUsd >= weeklyBudgetUsd`, throw `ConvexError({ code: "USAGE_LIMIT", planId })`. The prompt is not saved and no reply is scheduled.
- `streamReply`: resolves the sender's plan and passes the plan's model (Haiku for free, Sonnet 5 for paid) as a per-call override to `theologiaAgent.streamText` (fallback if the agent component doesn't support per-call model override: two Agent instances sharing config, differing only in `languageModel`).
- Race window (usage recorded after generation completes) means a user can slightly exceed the cap on their last message; acceptable — the next send is blocked.

## Frontend (apps/web)

### Chat usage meter

- `chat-usage-meter.tsx` consumes `api.usage.getUsage` via `useQuery`; `mock-usage.ts` deleted. Shows plan label, percent used, reset countdown (to the UTC reset from the query).
- The meter card gains an **Upgrade** `CheckoutLink` (all three paid product IDs; hidden for Church Team subscribers). Over 100%: card states the limit is reached — upgrade or wait for the reset.
- Blocked sends: catch the `USAGE_LIMIT` ConvexError in the chat composer and surface an inline notice (with upgrade link) instead of a dead request.

### User menu

- "Manage Subscription" (`CustomerPortalLink`) added to the user menu next to Sign Out; rendered only when the user has an active subscription.

### Free-tier banner

- Static banner on `/chat` for free users (plan from `getUsage`): upgrade for increased usage and better outputs, with a `CheckoutLink`. Hidden for paid users.

### Landing page

- Paid pricing cards in `hero.tsx` become `CheckoutLink`s when authenticated; signed-out visitors link to `/sign-up`.

## Environment setup (Dylan, when implementation reaches it)

Set in Convex (`npx convex env set …`):
`POLAR_ORGANIZATION_TOKEN` (sandbox token), `POLAR_WEBHOOK_SECRET`, `POLAR_SERVER=sandbox`, `POLAR_PRODUCT_SCHOLAR`, `POLAR_PRODUCT_MINISTRY`, `POLAR_PRODUCT_CHURCH_TEAM` (the three `*_TEST_ID` values from `apps/web/.env`).
Create a Polar webhook at `https://<deployment>.convex.site/polar/events` with `product.created`, `product.updated`, `subscription.created`, `subscription.updated` enabled.

## Error handling

- `USAGE_LIMIT` is a `ConvexError` with structured data so the client can distinguish it from generic failures.
- `usageHandler` failures must not kill the reply stream: recording is scheduled/isolated so a metering bug never blocks chat (worst case: an unmetered generation, logged).
- `getUsage` for an unauthenticated user returns null; the meter renders nothing.

## Testing

- Unit: cost computation per model (incl. cache token rates, micro-USD rounding), week-start/reset math around UTC Monday boundaries.
- convex-test: `recordUsage` upsert accumulation; `createConversation`/`sendMessage` blocked at cap for free and paid; model selection per plan; `getUsage` shape for free (no sub) and subscribed users.
- Manual (sandbox): checkout a Scholar sub, verify webhook sync → plan reflected in meter; exhaust a tiny test budget and verify the block + notice.

## Follow-ups (out of scope)

- Mode gating by tier (Ministry-only modes).
- Church Team pooled usage across seats.
- PRICING.md edit for free-on-Haiku is included in this slice; deeper doc reconciliation is not.

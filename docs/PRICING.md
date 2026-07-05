# Theologia — Pricing & Cost Model

This document defines the pricing tiers, per-tier usage limits, and the underlying API cost model that makes each tier profitable. It is the source of truth for usage enforcement; [GOAL.md](./GOAL.md) carries the summary table.

---

## Pricing Tiers

| Plan            | Price  | Best For                      | Usage                                                         |
| --------------- | ------ | ----------------------------- | ------------------------------------------------------------- |
| **Free**        | $0/mo  | Casual users, trial           | Limited usage — 20 queries/month                              |
| **Scholar**     | $19/mo | Serious laypeople, students   | Standard usage — ~150 queries/month (fair use)                |
| **Ministry**    | $39/mo | Pastors, apologists, teachers | Increased usage — ~300 queries/month + 50 deep-study sessions |
| **Church Team** | $99/mo | Church staff, study groups    | Pooled team usage — ~700 queries/month shared across 5 seats  |

---

## Cost Model

### Assumptions per query

A typical Theologia query (framework-aware Q&A with RAG):

- **Input:** ~8K tokens — framework system prompt + retrieved passages (Convex vector search) + conversation history. The framework system prompt is large and stable per-tradition, so it is prompt-cached; cache reads bill at ~0.1× the input rate.
- **Output:** ~1.5K tokens — answers are long-form, sourced, and exegetical.

Deep-study sessions (Debate Prep, Scripture Study Mode) are multi-turn; budget them at roughly **3× a standard query**.

### Model architecture: Claude Sonnet 5 (paid) + Haiku 4.5 (free)

**Paid-tier queries run on Claude Sonnet 5 (`claude-sonnet-5`); free-tier queries run on Claude Haiku 4.5 (`claude-haiku-4-5`).** Sonnet 5 is judged sufficient for every paid query type Theologia serves — Framework Q&A, comparisons, and the deep-study modes — so there is no Opus tier in the routing and no per-mode model split.

Claude API pricing as of July 2026:

| Model        | Input $/MTok | Output $/MTok | Est. cost/query (with caching) | Role                                             |
| ------------ | ------------ | ------------- | ------------------------------ | ------------------------------------------------ |
| **Sonnet 5** | $3 ($2 intro) | $15 ($10 intro) | ~$0.04 (~$0.027 intro)       | **Paid tiers** — Q&A, comparisons, deep-study    |
| Haiku 4.5    | $1           | $5            | ~$0.015                        | **Free tier** — all free queries                 |

> **Introductory pricing:** Sonnet 5 bills at $2/$10 per MTok through **August 31, 2026**, then reverts to $3/$15. All limits in this document are sized on the **standard** $3/$15 rate — the intro period is temporary margin upside (~33% lower cost per query), not a basis for capacity planning.

> **Models deliberately not used:** Fable 5 ($10/$50, always-on thinking) costs ~$0.20+/query and would cap Scholar at ~25 queries/month. Opus 4.8 ($5/$25) was previously slated for deep-study modes, but Sonnet 5 matches the need at 60% of the cost — dropping it cut deep-study session cost from ~$0.21 to ~$0.12 and funded a larger Ministry allowance.

Deep-study sessions (Debate Prep, Scripture Study Mode) are multi-turn at roughly **3× a standard query**: ~$0.12/session.

### Margin target

- Target gross margin: **~70%** (standard SaaS), leaving ~30% of revenue for model API spend after ~3% payment processing fees.
- Early-stage flexibility: if we accept a 50% gross margin (common for AI-native products pre-scale), every limit below roughly doubles. The limits are set at the 70% target so loosening is always an option; tightening is a churn event.

---

## Per-Tier Economics

### Free — $0/mo

| Metric               | Value                                          |
| -------------------- | ---------------------------------------------- |
| API budget           | Acquisition cost, not revenue                  |
| Limit                | 20 queries/calendar month (hard counter)       |
| Model                | Haiku 4.5                                      |
| Worst-case cost/user | ~$0.30/month                                   |

Free is a funnel, not a plan. Free queries run on Claude Haiku 4.5, capping the acquisition cost at ~$0.30/user/month at full utilization (20 queries). Usage is enforced by a hard counter — 20 queries per calendar month, counted transactionally at send time and resetting the 1st at 00:00 UTC — not a dollar budget. The product quality difference between free (Haiku) and paid (Sonnet 5) is an intentional conversion lever.

### Scholar — $19/mo

| Metric              | Value                                  |
| ------------------- | -------------------------------------- |
| Net revenue         | ~$18.40 after payment fees             |
| API budget (30%)    | ~$5.50/month                           |
| Limit               | ~150 queries/month fair use (≈5/day)   |
| Model               | Sonnet 5                               |

At ~$0.04/query, 150 queries ≈ $6.00 — right at budget at full utilization (and ~$4.00 during the intro-pricing window). The median user (~30–50 queries/month, ~$1.50–2 cost) is highly profitable; the cap exists to contain the tail, not the middle.

### Ministry — $39/mo

| Metric              | Value                                                 |
| ------------------- | ----------------------------------------------------- |
| Net revenue         | ~$37.80 after payment fees                            |
| API budget (30%)    | ~$11.30/month                                         |
| Limit               | ~300 standard queries/month + 100 deep-study sessions |
| Model               | Sonnet 5 (deep-study modes included)                  |

300 queries ≈ $12 plus 100 deep-study sessions at ~$0.12 ≈ $12 — worst case ~$24 at 100% utilization of both pools, but Ministry usage patterns (weekly sermon prep cycles) make full simultaneous utilization unrealistic; realistic heavy usage lands well inside budget. Moving deep-study off Opus 4.8 onto Sonnet 5 cut the per-session cost ~43%, which is what funds the doubled allowance (100 vs. the previous 50). Alternative accounting: count each deep-study session as 3 standard queries against a single 600-query pool.

### Church Team — $99/mo

| Metric              | Value                                        |
| ------------------- | -------------------------------------------- |
| Net revenue         | ~$96.00 after payment fees                   |
| API budget (30%)    | ~$28.80/month                                |
| Limit               | ~700 queries/month **pooled** across 5 seats |
| Model               | Sonnet 5                                     |

**Limits must be pooled, not per-seat.** At $99 for 5 seats, the effective price is $19.80/seat for Ministry-level features that cost $39 solo. Five heavy users on individual Ministry-sized limits would cost ~$56/month — over half of revenue. The pooled 700-query allowance (~140/seat, ≈$28 worst case) covers realistic team usage (most seats are light; one or two are heavy) while staying inside budget.

---

## Fair-Use Enforcement

1. **Paid tiers: hard weekly caps.** Each paid plan's allowance is enforced as a weekly window of the monthly API budget ÷ 4 (Scholar $5.50/wk, Ministry $11.30/wk, Church Team $28.80/wk), resetting Monday 00:00 UTC. Once cumulative spend reaches the weekly cap, further requests are blocked with an upgrade-or-wait message (the request that crosses the line completes, so actual spend can land slightly over budget). There is no grace period, no Haiku downgrade at any cap level, and no soft-cap at 120%.
2. **Free tier: hard monthly query counter.** Free usage is limited to exactly 20 queries per calendar month, counted transactionally at send time and resetting the 1st at 00:00 UTC. No dollar metering applies to the free tier.
3. **Metering unit is dollar cost (paid) or query count (free).** Paid usage is tracked as actual API spend against the weekly budget; the UI surfaces the percentage used and a countdown to Monday reset. Free users see a query counter (e.g., "0 / 20"). Users never see raw dollars or token counts. The per-query estimates above remain the sizing and marketing vocabulary.
4. **Deep-study sessions metered separately** (or at a 3× query multiplier) so a Debate Prep marathon doesn't silently exhaust a Ministry user's standard allowance.
5. **Upgrade prompts at the cap** are the conversion mechanism: Scholar → Ministry at the query cap, Ministry → Church Team when a user shares exports repeatedly.

---

## Cost Levers

These are already partially assumed in the per-query estimates; verifying them in production protects the model:

| Lever                | Impact                                                                                                     |
| -------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Prompt caching**   | Framework system prompts are large and stable per-tradition — cache reads bill at ~0.1×. Verify `cache_read_input_tokens` is nonzero in production; a silent cache invalidator (e.g., a timestamp in the system prompt) would roughly double input costs. |
| **Batch API (50% off)** | Use for everything non-interactive: embedding the patristic library, precomputing tradition comparisons, refreshing the resource engine. |
| **Model routing (optional)** | The architecture is deliberately single-model, but routing trivial queries (definitions, verse lookups) to Haiku remains available if margins ever need it — 30% of queries on Haiku would cut blended cost ~20%. |
| **Output length discipline** | Output tokens are 5× input price. Structured, well-scoped answers (vs. unbounded essays) are the single biggest per-query cost control. |

---

## Known Risks

- **"Unlimited" legacy wording.** Earlier copy promised "Unlimited Q&A" on Scholar. A single power user at 20 queries/day costs ~$24/month — more than they pay. All copy (homepage, GOAL.md, checkout) must use the usage-tier wording; grandfathered users, if any, need a migration plan.
- **Church Team per-seat arbitrage.** If pooled limits ever become per-seat, the tier is immediately unprofitable (see above).
- **Token creep.** Longer conversation histories and richer RAG context inflate the 8K-input assumption over time. Cap history length sent to the model and monitor per-query token averages monthly.
- **Intro-pricing cliff.** Sonnet 5's $2/$10 introductory rate ends **August 31, 2026** — costs rise ~50% overnight to the standard $3/$15. All limits here are already sized on the standard rate, so nothing breaks; just don't let the intro-period margins tempt anyone into raising limits that only pencil at $2/$10.
- **Model price changes.** The cost model is pinned to July 2026 Claude API pricing (Sonnet 5 at $3/$15 standard). Re-run the math when pricing or the model changes.

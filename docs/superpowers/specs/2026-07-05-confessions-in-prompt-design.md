# Confessions in the Prompt + Patristics Guardrail — Design

**Date:** 2026-07-05
**Status:** Approved

## Problem

Catechism mode instructs the model to quote confessional documents it does not have — verbatim quoting from recall produces plausible-looking fabrications with wrong section numbers, which is a credibility-ending failure for the target audience (pastors, seminarians). Separately, every mode can hallucinate patristic quotations with invented volume/page citations. A full RAG pipeline is deliberately deferred past MVP (see NEXT_STEPS.md → Primary-source library); this slice covers the gap with static prompt injection for the small confessional corpus and a prompt guardrail for everything else.

## Decision summary

- Inject the full text of the user-selected confessional document into the system prompt in **Catechism mode only**. All other modes keep model recall plus a strengthened anti-fabrication guardrail.
- Texts live as **static TypeScript string modules** committed to the repo — no DB table, no storage, no retrieval.
- Prompt caching is attempted as part of this slice (a ~60K-token system prompt makes it load-bearing), with a defined fallback if the agent pipeline blocks it.

## Approaches considered

| Approach | Verdict |
|---|---|
| A. Static TS modules, appended in `buildSystemPrompt` | **Chosen.** Zero runtime moving parts; texts version-controlled and PR-reviewable; deterministic prompt string (cache-friendly). |
| B. Convex table seeded with texts, queried in `streamReply` | Rejected — adds a query, seeding, and schema surface for data that changes roughly never. |
| C. Runtime fetch from file storage/CDN | Rejected — strictly worse than B at this scale. |

## Design

### 1. Corpus

All 12 documents in `DOCUMENTS` (`packages/backend/convex/lib/studyData.ts:174`), sourced from public-domain editions (CCEL, Schaff's *Creeds of Christendom*, Wikisource) during implementation.

Normalization rules, applied to every document:

- Plain text (no markdown structure the model could echo into replies).
- Small header: title + edition/translation note (e.g. "Text: Schaff, *Creeds of Christendom*, vol. III").
- The document's own numbering preserved exactly (`Q. 1.` / `Chapter III, Section 1` / `Canon 4`) so `<article label="...">` citations are checkable against the source.
- Scripture proof-text lists retained where the source edition includes them (they feed the `<article proofs="...">` attribute).

Curation calls:

- **Council of Trent** (`trent`): doctrinal decrees + canons only. The disciplinary reform decrees are not confessional content and would roughly triple the size.
- **Luther's Catechisms** (`luthers-catechisms`): Small + Large Catechism together in one module.
- **Westminster Standards** (`westminster`): WCF + Larger + Shorter Catechism in one module.

Expected sizes: most documents 5K–25K tokens; Westminster Standards ~60K; Trent (curated) ~50K. Total corpus roughly 1–2 MB of source text — well within Convex bundle limits.

### 2. Module layout

```
packages/backend/convex/lib/confessions/
  index.ts            — getDocumentText(id: string): string | undefined
  westminster.ts      — export const TEXT = `...`
  heidelberg.ts
  belgic.ts
  dort.ts
  london-1689.ts
  augsburg.ts
  luthers-catechisms.ts
  ecumenical-creeds.ts
  chalcedon.ts
  trent.ts
  baltimore.ts
  dordrecht.ts
```

`index.ts` maps `DOCUMENTS` ids to texts. Unknown or missing id → `undefined`.

### 3. Prompt assembly (`packages/backend/convex/lib/prompts.ts`)

The catechism mode section appends, when `getDocumentText(setup.document)` resolves:

```
## Document text (authoritative)
The full text of <label> follows. When quoting the document, quote verbatim
from this text only, and cite using its own numbering in <article> labels.
Do not quote this document from memory.

<full text>
```

- Ordering stays PERSONA → TAG_SPEC → mode section → document text. The entire system prompt is static per conversation, so a single cache breakpoint at the end covers everything.
- If `setup.document` is missing or has no text module, the prompt falls back to today's behavior (no injected block).

### 4. Patristics guardrail

- **PERSONA** (`prompts.ts:18`): sharpen the existing "never invent quotations" line. For primary sources **not provided in context** — the Church Fathers especially — paraphrase closely and attribute ("Augustine argues in *City of God* that…"); give book/chapter references only when certain; never produce volume or page citations from memory. Verbatim `<source>` quotes remain allowed only for passages the model is confident are genuine.
- **Library mode section**: tighten its existing caution with the same rule.

### 5. Prompt caching

Included in this slice because the injected document makes the system prompt large enough that caching is load-bearing (Westminster ≈ 60K tokens).

- Attempt: attach Anthropic `cacheControl` (`{ type: "ephemeral" }`) to the system prompt via AI SDK provider options through `theologiaAgent.streamText` in `streamReply` (`packages/backend/convex/chat.ts:165`).
- Verify: send two messages in one catechism conversation; confirm `cache_read_input_tokens > 0` on the second. Also confirm the `usageHandler` token-extraction assumption flagged in NEXT_STEPS.md (whether AI SDK `inputTokens` includes cache tokens) now that cache counts are nonzero.
- Known risk: `@convex-dev/agent` may not expose per-message provider options for `system`. **Fallback:** ship without caching — worst case ≈ $0.18/message input on Westminster, catechism is Ministry-tier, acceptable at MVP scale — and record the finding on the existing NEXT_STEPS caching item.

### 6. Cost envelope

- Catechism mode, uncached: ~$0.015–$0.18 input per message depending on document (at Sonnet $3/MTok).
- Cached: ~0.1× on reads after the first message per 5-minute window.
- No change to Q&A / other modes, so the ~$0.04/query PRICING.md cost model is untouched for the free tier.

### 7. Testing

Extend `packages/backend/convex/lib/prompts.test.ts`:

- For every id in `DOCUMENTS`: the catechism prompt contains the document text block and the "Do not quote this document from memory" instruction.
- PERSONA contains the patristics guardrail language.
- Fallback: catechism prompt without a resolvable document matches today's shape (no document block).

New corpus sanity test (`confessions` module):

- Every `DOCUMENTS` id resolves to non-empty text.
- Each text contains its expected numbering markers (e.g. Heidelberg contains `Q. 1.`, Westminster contains both `Chapter I` and catechism question numbering, Trent contains `Canon`).

### 8. Out of scope

- Injecting standards into Q&A / Scripture Study / Debate Prep (revisit once caching is proven and hit rates are known).
- Patristics ingestion, embeddings, or any RAG (post-MVP, once there are users).
- Mode gating by tier (separate NEXT_STEPS item).

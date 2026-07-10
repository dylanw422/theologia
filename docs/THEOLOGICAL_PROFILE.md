# Theologia — Theological Profile

> Feature spec. Status: **proposed**. Companion to [GOAL.md](./GOAL.md) (philosophy), [PRICING.md](./PRICING.md) (cost envelope), [DESIGN.md](./DESIGN.md) (visual language).

---

## The Feature in One Paragraph

The Theological Profile is a persistent, structured map of what a user actually believes, assembled automatically from positions they affirm across their conversations in Theologia. It is organized by the classical theological loci, sourced back to the conversations where each position was taken, and — this is the point — analyzed for **tensions**: places where two things the user has affirmed sit uneasily together, where a stated position carries implications the user hasn't drawn out, or where their view has quietly shifted over time. The profile is the user's own confession of faith, written by their own study, held up so they can see its full shape.

This is the feature form of GOAL.md's core priority: *"Theologia does not tell users what to believe; it makes sure they can see the full shape of what they already believe, including its consequences and its pressure points."* Today that happens within a single conversation and evaporates when it ends. The profile makes it cumulative.

## Why This Isn't a Claude Wrapper Feature

A chat session — any chat session, however well prompted — is stateless across conversations. It cannot remember that the user affirmed unconditional election in March, notice that their reading of John 6 in July quietly assumes the opposite, and put the two side by side. The profile requires structured extraction, a queryable store of claims, cross-conversation diffing, and background jobs. None of that is reachable by prompting. It is also the property a subscription business needs: the profile compounds with usage, so the product gets harder to leave the longer someone studies.

---

## User Experience

### The profile page (`/profile` — user-facing name: **"Your Theology"**)

A single page organized by the classical loci:

1. Scripture & Revelation
2. Theology Proper (God, Trinity)
3. Christology
4. Pneumatology
5. Anthropology & Sin
6. Soteriology
7. Ecclesiology & Sacraments
8. Eschatology

Each locus lists the user's **positions**: one-sentence statements in the user's own voice ("Regeneration precedes faith"), each with the date affirmed, a link to the source conversation, and the framework the user was studying under at the time. Visual register per DESIGN.md: the page reads as a manuscript — Fraunces statements, Geist Mono apparatus (dates, citations, locus labels), hairline rules between loci. It should feel like reading one's own confession in a critical edition, because that is literally what it is.

An empty profile shows the loci as faint scaffolding with an explanation of how it fills in — the emptiness itself communicates "this grows as you study."

### Tensions

A dedicated section (and a count badge on the profile nav item) listing detected tensions. Each tension card shows:

- The two positions in conflict, quoted, each linking to its source conversation
- A short, neutral description of the tension — *what* sits uneasily, not who is right
- A historical note where one exists: how the user's own tradition has resolved (or lived with) this tension
- Three actions: **Study this** (opens a new Q&A conversation seeded with the tension), **Resolved** (user records how they resolved it, in their own words — this becomes part of the profile), **Dismiss** (not a real tension; feeds extraction quality review)

Tone is everything here. Per GOAL.md: *"The aim is never doubt for its own sake, but depth."* Copy never says "contradiction," never scores or grades the user, never implies a tradition-approved answer exists. The register is a careful study partner pointing at the text, not a gotcha.

### In-chat surfacing

Two touchpoints inside conversations, both deliberately quiet:

- **Profile awareness in answers.** A compact summary of the user's affirmed positions (capped — see Cost) is appended to the system prompt, so answers can build on what the user has already worked through instead of re-explaining it. This is also a straightforward answer-quality win: the AI knows the user, which no fresh Claude chat does.
- **Tension followups.** When a reply touches a stored position, the model may offer it as a `<followups>` chip ("How does this square with my view of X?") — the user pulls; we never push. No mid-answer interruptions, no toast notifications about their soteriology.

### User control (non-negotiable)

Religious beliefs are sensitive personal data — special-category under GDPR, and more importantly, sacred to the people we serve. Therefore:

- **Explicit opt-in** at first eligible conversation, with a plain explanation of what is stored. Off by default.
- Every position is editable, deletable, or excludable by the user. A "pause tracking" toggle stops extraction without deleting anything.
- One-click export (markdown — it's their confession, they should be able to keep it) and one-click delete-everything.
- Profile data is never used across users, never in marketing, never in training. Say so in the UI, not just the policy page.

---

## How It Works

### 1. Extraction pipeline

When a conversation goes idle (no messages for ~30 minutes) or is explicitly ended, a scheduled Convex action runs an extraction pass over the transcript with **Haiku 4.5** (this is exactly the "optional cost lever" role PRICING.md reserves for it; extraction is non-interactive, so it also qualifies for the Batch API at 50% off).

The extraction prompt's one hard rule: **extract only what the user affirmed in their own voice.** Not what the AI said, not questions the user asked, not positions the user voiced while steel-manning an opponent in Devil's Advocate mode, not passages the user merely studied. The signal is first-person affirmation — "I hold," "I'd answer that objection by," "that's my view," agreement after challenge. Devil's Advocate transcripts are the richest source (a user *defending* a position under pressure is the strongest affirmation we get) and the most dangerous (the user sometimes voices the other side to test it), so the prompt treats mode context explicitly. When in doubt, extract nothing — a sparse accurate profile beats a full noisy one, and every misattributed belief is a trust incident with exactly the audience that screenshots such things.

Each extracted claim:

```
{
  userId,
  locus,                    // one of the eight loci
  topic,                    // slug, e.g. "election", "baptismal-efficacy"
  statement,                // one sentence, user's voice
  stance: "affirmed" | "denied" | "uncertain",
  strength: "settled" | "leaning" | "exploring",
  sourceConversationId, sourceMessageId,
  frameworkAtTime, createdAt
}
```

### 2. Position store

New Convex tables: `positions` (above), `tensions`, `profileSettings` (opt-in state, pause flag). New claims on an existing topic don't overwrite — they append, giving each topic a history. The profile page shows the latest; the history powers the development-over-time view (Phase 3) and drift detection.

### 3. Tension detection

On each new claim, a background action gathers the user's existing positions in the same and adjacent loci (adjacency map is static — soteriology borders anthropology and theology proper, etc.) and runs a single **Sonnet 5** judgment pass: *do any of these pairs stand in real theological tension, and if so, characterize it neutrally and note how the user's tradition has handled it.* Sonnet, not Haiku, because tension judgment is exactly the kind of subtle theological reasoning the product's credibility rests on — a false "contradiction" is worse than a missed one, and the prompt is tuned to abstain. Detected tensions are stored with `status: "open" | "resolved" | "dismissed"` and surfaced only on the profile page and via pull-based followups.

### 4. Prompt injection

A `profileSummary` (generated after each extraction pass, cached on the user) is appended to the system prompt for opted-in users: at most ~600 tokens, latest position per topic, settled positions first. The cap is a hard truncation, not a hope — PRICING.md's token-creep risk applies directly here, and 600 input tokens at cached rates is noise (~$0.0002/query).

---

## Cost

Per PRICING.md's envelope (~30% of revenue on API spend):

| Operation | Model | Est. cost | Frequency |
| --- | --- | --- | --- |
| Extraction pass | Haiku 4.5 (batch) | ~$0.005–0.008 | per completed conversation |
| Tension judgment | Sonnet 5 (batch) | ~$0.01–0.02 | per conversation that yields new claims |
| Profile summary refresh | Haiku 4.5 | ~$0.002 | per extraction pass |
| Prompt injection | cached input | ~$0.0002 | per query, opted-in users |

Worst case adds roughly $0.02–0.03 per *conversation* (not per query) — a heavy Scholar user at 30 conversations/month adds well under $1 against a $5.50 budget. No pricing-table change needed.

## Tier Placement

**Scholar and above.** The profile is the retention flagship — it belongs behind the paywall, and its compounding value is the upgrade argument for serious free users. Free tier sees the profile page as a locked preview (the eight loci, greyed, with copy explaining what fills them). Church Team note: profiles are strictly individual — never pooled, never visible to other seats, including the team owner. A staff member's private theological wrestling is not their senior pastor's dashboard. This is a hard rule.

## Rollout

- **Phase 1 — the ledger.** Opt-in flow, extraction pipeline, `positions` table, read-only profile page with source links, edit/delete/export controls. No tensions yet. Ship, then manually review extraction quality across ≥50 real conversations before Phase 2.
- **Phase 2 — the mirror.** Tension detection, tensions UI with Study this / Resolved / Dismiss, dismissal-rate monitoring (a >25% dismissal rate means the judgment prompt isn't ready — pull back and tune).
- **Phase 3 — the companion.** Prompt injection (profile-aware answers), tension followup chips, development-over-time view per topic ("your view of the atonement, March → July").

## Success Metrics

- **Adoption:** % of paid users opted in (target ≥60% — if lower, the consent copy is scaring people or the value isn't landing)
- **Density:** % of opted-in users with ≥5 positions after 30 days
- **Engagement:** % of open tensions receiving any action within 14 days; "Study this" click-through is the north star (a tension that starts a study session is the product working exactly as designed)
- **Quality:** tension dismissal rate <25%; position edit/delete rate <10%
- **Business:** week-4 retention of profile-active users vs. eligible non-opted-in users — this is the number that justifies the feature

## Risks

- **Misextraction is the existential risk.** Attributing a steel-manned opposing view to the user as *their* belief is the single worst failure mode — it breaks trust on precisely the "intellectually honest" brand promise. Mitigations: conservative extraction, strength labels, per-position source links (the user can always see *why* the system thinks they hold this), Phase 1 manual review gate.
- **Creepiness.** "The app is keeping a file on my beliefs" is one framing; "my own confession, written by my own study" is the other. The difference is opt-in, visible controls, export, and manuscript-register design. Never surface profile knowledge in a way the user didn't ask for.
- **Pastoral misuse.** A Church Team owner asking for seat-level profiles will sound like a reasonable feature request. It isn't. See tier placement.
- **Tension fatigue.** If every conversation spawns tensions, users stop looking. Cap open tensions surfaced (e.g., 5 at a time, strongest first) and let the abstention-biased judgment prompt do its job.

---

*The profile is Theologia's philosophy made cumulative: convictions examined not once in a good conversation, but continuously across a life of study.*

# Theologia — Marketing Plan: 10 → 100 → 1,000 Users

A stage-gated plan. Each stage has one job, one primary channel, explicit success criteria, and a gate you must pass before spending effort on the next stage. Skipping gates is how solo products die: you end up marketing to 1,000 people with a product that hasn't survived contact with 10.

**Current assets:** a live homepage with a working waitlist (Convex `waitlist.join`), auth, and a fully designed `/chat` experience running on scripted content. **Current gap:** answers aren't real yet (no AI slice). That gap dictates the sequencing below — Stage 0 and Stage 1 recruiting can start now; nobody pays until the product answers real questions.

---

## Positioning (write this once, use it everywhere)

**One-liner:** *Theologia is a study tool that takes your theology as seriously as you do — it answers from within your tradition, shows you the strongest case against you, and puts 2,000 years of church history behind every question.*

**The hook that spreads:** Devil's Advocate mode. "An AI that steel-mans the other side" is novel, demoable in 30 seconds, and inherently shareable — people screenshot the objections to *their own* view. Lead with it in every channel; Q&A is the retention feature, not the acquisition feature.

**The trust position:** GOAL.md's "not an advocacy tool" stance is the moat. Every competing "Bible AI" is either generically evangelical or embarrassingly shallow. "We will represent your tradition — and its critics — accurately" is the claim to defend in public, and the one that earns pastors' trust.

**Who buys, in order of reachability:**
1. **Theology-online enthusiasts** — Reddit/X/YouTube-comment theology nerds. Easiest to reach, loudest amplifiers, worst payers. They're the top of funnel, not the business.
2. **Apologists & debate hobbyists** — Devil's Advocate + Debate Prep are built for them. Mid-size niche, high engagement.
3. **Seminary students** — perpetual paper-writers, price-sensitive but concentrated in ~50 reachable institutions.
4. **Pastors & teaching elders** — sermon prep weekly, real budgets, buy the Ministry tier. Slowest to adopt, highest LTV, reached through trust chains not ads.

---

## Stage 0 — Before any marketing (the gate to Stage 1)

Do these first; everything downstream depends on them.

- [ ] **Ship the real Q&A slice** for at least 2–3 traditions done *excellently* (suggest: Reformed, Roman Catholic, Arminian/Wesleyan — maximum pairwise friction, biggest online communities). Better to launch with 3 great traditions and "more coming" than 12 mediocre ones. Depth is the product.
- [ ] **Instrument activation.** Define it now: *a user who starts 3+ studies across 2+ days*. Wire basic analytics (PostHog free tier) for: waitlist→signup, signup→first answer, first answer→activation. You cannot run Stage 1 feedback loops blind.
- [ ] **Record the 90-second demo video.** Screen capture: pick Reformed → ask "Does baptism save?" → answer with history block → switch to Devil's Advocate → watch it argue back. The fresco UI is genuinely striking; let it carry the video. This becomes the pinned tweet, the DM attachment, the landing-page embed.
- [ ] **Waitlist email #1.** You're already collecting emails — send something ("here's what we're building, here's the demo, reply with the theological question you'd ask first"). Replies = your first user interviews, free.
- [ ] **Set up a public build log** (an X/Twitter account posting progress). "Building an AI that can argue Molinism vs Calvinism fairly" is inherently interesting content; build-in-public compounds before launch.

---

## Stage 1 — First 10 users (Weeks 1–4 after real answers exist)

**Job:** Not growth. *Judgment.* Ten hand-picked people who (a) match the GOAL.md personas, (b) will actually use it weekly, and (c) will tell you the truth. These ten decide what you fix before anyone else sees it.

**Method — recruit by hand, one at a time:**

1. **Your own graph first (target: 3–4).** Your pastor, an elder, the seminary friend, the guy from your small group who won't stop talking about supralapsarianism. Personal ask: "I built this for people like you. Use it for your actual prep this week, then give me 20 minutes."
2. **The waitlist (target: 3–4).** Email the list: "I'm taking 10 founding users. You get it free for a year + direct line to me. In exchange: use it weekly, one call per month." Selection bias toward people who reply with *specific* questions — they're the serious ones.
3. **One community, one honest post (target: 2–3).** Pick a single subreddit where you can post transparently (r/Reformed's open threads, or r/theology). Not an ad — a builder's post: "I'm building a study tool that argues the strongest version of the *other* side. Looking for 3 people from different traditions to break it." Cross-tradition testers matter: you need a Catholic and an Arminian stress-testing the Reformed prompts and vice versa — accuracy-across-traditions is the whole brand.

**Cover the spread:** aim for ≥4 traditions, ≥1 working pastor, ≥1 seminary student, ≥1 self-identified apologist among the ten.

**Operating cadence:**
- Weekly: read every conversation transcript (with permission — make it a founding-user term). Where did answers go generic? Where did users bail? Transcripts are the roadmap.
- Biweekly: 20-minute call with each user. Ask only two questions: "What did you use it for this week?" and "What did you *almost* use it for but didn't?"
- Fix the top recurring complaint every week. Ship visibly; tell them what changed because of them.

**Gate to Stage 2:** ≥6 of 10 are active in week 4 without prompting, **and** at least 3 have said some version of "can I show this to someone." If you don't have that, the problem is product, not distribution — stay here.

---

## Stage 2 — First 100 users (Months 2–4)

**Job:** Find one repeatable channel. 100 users ≈ 10 founding users' word-of-mouth + one channel that produced ~60–80 signups you can trace. Try the three plays below *in order*, two weeks each; double down on the first one that works, drop the rest.

**Play A — Community presence (highest probability).**
Become a known, genuinely helpful participant in 2–3 places — not a drive-by promoter. Candidates, chosen for density of the target persona:
- **Reddit:** r/Reformed (~400k, weekly open threads), r/apologetics, r/theology, r/Catholicism or r/OrthodoxChristianity (to prove the cross-tradition claim), r/seminary.
- **X/Twitter theology circles:** the "theobro" cluster + Catholic Twitter + orthobros. Your build-log account posts *artifacts*, not announcements: screenshot a Devil's Advocate exchange on Romans 9, a four-tradition comparison table, a catechism quiz. The comparison-table screenshots are made for quote-tweets ("they did my tradition dirty/fairly" is engagement either way — and every accuracy complaint is free QA).
- **Discord/Facebook:** apologetics Discords; confessional Facebook groups (enormous among pastors: Reformed pub-style groups, LCMS pastor groups, SBC groups). Facebook is where the 45-year-old pastor actually is.

Rules: respect self-promo norms (ask mods first, or stay in designated threads); answer theology questions helpfully with the product as a footnote, not a headline; never sockpuppet. In this audience, one astroturfing accusation is fatal — intellectual honesty is the brand.

**Play B — The launch moments.**
- **Product Hunt + Hacker News ("Show HN: an AI that steel-mans theological positions")** — not for the core audience, but for the faith-tech crowd, early adopters, and the SEO/backlink halo. HN will grill you on hallucination and bias; prepare honest answers (they're also your FAQ page).
- **Waitlist launch email** with founding-user quotes and the demo video. A waitlist that's been warmed by 2–3 progress emails converts several times better than a cold one.
- **FaithTech / Christian developer communities** (FaithTech Slack, Church Mag, faith+AI newsletters) — small but they write about exactly this.

**Play C — Borrowed audiences (podcast/YouTube guesting, not sponsoring yet).**
Pitch yourself as a *story*, not an ad: "I'm building an AI that argues both sides of the Calvinism debate — here's what I've learned about how traditions actually disagree." Targets in the reachable tier: mid-size theology podcasts and YouTube channels (Remnant Radio–size, denominational podcasts, seminary-adjacent shows, apologetics streams that love live demos). One good appearance where the host runs Devil's Advocate live on air is worth 50 posts.

**Support work during Stage 2:**
- **Referral loop, minimal version:** founding users and new signups get "give a month of Scholar, get a month" links. Theology is social; make sharing cost nothing.
- **Testimonials with titles.** "M.Div. student, RTS" / "Pastor, LCMS" under every quote. This audience trusts credentials and tribes.
- **Start the SEO seedbed now** (it pays off in Stage 3): stand up `/compare/*` and `/catechism/*` public pages generated from content you *already wrote* for the mock — the 12-tradition comparison dictionary and the 12 catechism articles are ready-made programmatic-SEO pages ("Reformed vs Lutheran on faith and works", "Heidelberg Catechism Q1 explained"). Each page ends in the product ("Ask this question from within your tradition →").

**Metrics that matter:** traceable source per signup (ask at signup: "how did you find us?" — one field, free text); signup→activation ≥40%; week-4 retention of activated users ≥30%. **Gate to Stage 3:** one channel has produced 25+ signups in a month, twice in a row, and you know why.

---

## Stage 3 — First 1,000 users (Months 4–12)

**Job:** Scale the proven channel, add a compounding one (SEO), and convert community trust into institutional distribution. At this stage you're also converting free → paid seriously (at GOAL.md pricing, ~1,000 users with a plausible 5–8% paid mix ≈ $600–1,100 MRR — the goal of this stage is users and proof, not revenue).

**Engine 1 — Content flywheel (compounding, start early, harvest here).**
- Scale the programmatic pages: every tradition-pair × doctrine comparison ("Calvinism vs Arminianism on election", "Catholic vs Orthodox on the papacy"), every catechism question, every "what does [passage] mean" for contested passages (Romans 9, John 6, 1 Peter 3:21…). These are high-intent, evergreen, low-competition queries asked by *exactly* the GOAL.md persona. Target: 100+ indexed pages by month 6.
- Weekly artifact posts continue on X/FB — comparison tables and Devil's Advocate screenshots remain the shareable unit.
- A monthly email ("This month in the study" — best questions asked, a featured primary source) keeps the waitlist/free tier warm.

**Engine 2 — Creator partnerships (paid + earned).**
Now sponsor, don't just guest: mid-tier theology YouTube/podcasts (50k–500k subs) where CPMs are cheap and audience match is total. Structure every spend as a trackable code (`GAVIN20` style) + a *demo*, never a read-only ad — the product sells when seen. Prioritize channels whose comment sections already argue about doctrine: debate-review channels, denominational explainers, apologetics streams. One flagship move: offer a well-known apologetics channel a "prep your next debate with it, on camera" collaboration.

**Engine 3 — Institutional beachheads.**
- **Seminaries:** a campus rep program — free Ministry tier for 2–3 students per campus who demo it in study groups; a "seminary plan" landing page. Target the big ten (SBTS, RTS, DTS, Westminster, TEDS, Gordon-Conwell, Concordia, Duke Div, Fuller, Wheaton grad). Phase 4 of GOAL.md is institutional licensing; these reps are the pipeline.
- **Church Team tier as distribution:** every Ministry-tier pastor is a potential 5-seat team. In-product: "invite your elders/study group" once shared features exist (GOAL.md Phase 3).
- **Denominational media:** pitch write-ups to outlets each tribe reads (TGC, Christianity Today's tech desk, Catholic World Report, denominational magazines). The story: "the AI study tool that refuses to pick a side."

**What NOT to do (at any stage):**
- No broad paid social (Meta/Google) before Stage 3, and only against proven landing pages — the persona is cheap to reach organically and expensive to target by ads.
- No "AI will replace your pastor" framing, ever; GOAL.md's "not a replacement for the church" line goes in the FAQ and stays there.
- No engagement-bait dunking on any tradition from the official account. The brand is the referee, not a player.
- Don't launch all 12 traditions shallow to seem bigger. Every inaccurate answer screenshot in this audience travels ten times farther than a good one.

---

## Cadence summary

| Stage | Timeframe | Primary motion | Weekly time | Gate |
|---|---|---|---|---|
| 0 | now | Ship real answers (3 traditions), demo video, analytics, waitlist email | build time | real Q&A live |
| 1 → 10 | wks 1–4 | Hand-recruit 10 founding users, read transcripts, fix weekly | ~5h marketing | 6/10 active, 3 unprompted shares |
| 2 → 100 | mo 2–4 | Community presence + launch moments + guesting; pick the channel that works | ~8–10h | one channel: 25+ signups/mo, twice |
| 3 → 1,000 | mo 4–12 | SEO flywheel + creator sponsorships + seminary/church beachheads | scale winner | 1,000 signups, ≥35% activation, paid mix started |

The single most important discipline: **at each stage, the constraint is different.** At 10 it's product truth. At 100 it's finding one channel. At 1,000 it's feeding the channel that already works. When growth stalls, diagnose which constraint you're actually at — it's usually one stage earlier than you think.

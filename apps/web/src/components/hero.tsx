"use client";
import { useState } from "react";
import Link from "next/link";
import { CheckoutLink } from "@convex-dev/polar/react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@theologia/backend/convex/_generated/api";

import styles from "./hero.module.css";

type ActiveSection = "why" | "library" | "pricing" | null;

const NAV_SECTIONS = [
  { id: "why", label: "Why Theologia?" },
  { id: "library", label: "Library" },
  { id: "pricing", label: "Pricing" },
] as const;

const WHY_FACETS = [
  {
    id: "conviction",
    label: "Conviction",
    headline: (
      <>
        Most AI reads Scripture from <em>nowhere</em>.
      </>
    ),
    lede: "Ask a generic chatbot a doctrinal question and you get the average of the internet — tradition-less, source-less, allergic to conviction. Theologia answers from within a real tradition: your confession, your hermeneutics, the theologians who shaped how your church reads the text. Where your tradition debates itself, it says so.",
  },
  {
    id: "steelman",
    label: "The other side",
    headline: (
      <>
        Tested against <em>their best</em>, not a strawman.
      </>
    ),
    lede: "Anyone can win against a strawman. Devil's Advocate and Debate Prep argue the opposing tradition at full strength — its sharpest exegetes, its strongest texts — then press where a capable opponent would actually press. If your position survives here, it will survive the pulpit, the classroom, and the debate.",
  },
  {
    id: "work",
    label: "Built for the work",
    headline: (
      <>
        Modes shaped by <em>real study</em>, not chat.
      </>
    ),
    lede: "Sermon prep, debate prep, catechism teaching, verse-by-verse study — each a purpose-built mode with its own discipline: Scripture quoted in place, original-language notes where the vocabulary matters, primary sources cited precisely enough to look up. Not a chatbot with a Bible bolted on — a study environment.",
  },
] as const;

const CITATIONS = [
  { ref: "2 Tim 2:15", note: "rightly dividing" },
  { ref: "Nicaea · 325", note: "the creed" },
  { ref: "Rom 9", note: "contested" },
] as const;

const FRAMEWORKS = [
  "Reformed",
  "Lutheran",
  "Wesleyan",
  "Roman Catholic",
  "Eastern Orthodox",
  "Baptist",
  "Anglican",
  "Pentecostal",
  "Oneness Pentecostal",
  "Anabaptist",
  "Dispensational",
  "New Covenant",
] as const;

const PRICING = [
  {
    plan: "Free",
    price: "$0",
    period: "/mo",
    productKey: null,
    desc: "Limited usage · 20 queries/month · Framework Q&A",
  },
  {
    plan: "Scholar",
    price: "$19",
    period: "/mo",
    productKey: "scholar",
    desc: "Standard usage · Devil's Advocate · Comparison · Resource Engine",
  },
  {
    plan: "Ministry",
    price: "$39",
    period: "/mo",
    productKey: "ministry",
    desc: "Increased usage · All Scholar + Debate Prep · Catechism Tutor · Patristic Library · Scripture Study · Export",
  },
  {
    plan: "Church Team",
    price: "$99",
    period: "/mo",
    productKey: "churchTeam",
    desc: "Pooled team usage · 5 seats · All Ministry features · Shared notes & sessions",
  },
] as const;

export default function Hero() {
  const [active, setActive] = useState<ActiveSection>(null);
  const [whyFacet, setWhyFacet] = useState(0);
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const joinWaitlist = useMutation(api.waitlist.join);
  const user = useQuery(api.auth.getCurrentUser);
  const products = useQuery(api.polar.getConfiguredProducts);
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const alreadyRegistered = useQuery(
    api.waitlist.isRegistered,
    isEmailValid ? { email } : "skip",
  );

  const handleWaitlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || alreadyRegistered || isLoading) return;
    setIsLoading(true);
    try {
      await joinWaitlist({ email });
      setSubmitted(true);
    } finally {
      setIsLoading(false);
    }
  };

  const toggle = (section: ActiveSection) =>
    setActive((prev) => (prev === section ? null : section));

  return (
    <section className={styles.hero}>
      <div className={styles.fresco} aria-hidden />
      <div className={styles.overlay} aria-hidden />
      <div className={styles.grain} aria-hidden />

      <div className={styles.shell}>
        <nav className={styles.nav}>
          <button
            onClick={() => setActive(null)}
            className={styles.wordmark}
          >
            Theologia
          </button>
          <div className={styles.navLinks}>
            {NAV_SECTIONS.map((sec) => (
              <button
                key={sec.id}
                onClick={() => toggle(sec.id)}
                className={`${styles.navBtn}${active === sec.id ? ` ${styles.navBtnActive}` : ""}`}
              >
                {sec.label}
              </button>
            ))}
            <span
              className={styles.navSignInDisabled}
              aria-disabled="true"
              title="Sign in is disabled while Theologia is in waitlist launch"
            >
              Sign in
            </span>
          </div>
        </nav>

        <div className={styles.main}>
          <div className={styles.inner}>
            <aside className={`${styles.apparatus} ${styles.reveal} ${styles.d4}`}>
              {CITATIONS.map((c) => (
                <span key={c.ref} className={styles.cite}>
                  <span className={styles.citeRef}>{c.ref}</span>
                  <span className={styles.citeNote}>{c.note}</span>
                </span>
              ))}
            </aside>

            <div className={styles.textColumn}>
              <div key={active ?? "default"}>
                {active === null && (
                  <>
                    <p className={`${styles.eyebrow} ${styles.reveal} ${styles.d1}`}>
                      An AI study environment for serious theology
                    </p>
                    <h1 className={`${styles.headline} ${styles.reveal} ${styles.d2}`}>
                      Study theology with <em>the whole church</em> in the room.
                    </h1>
                    <p className={`${styles.lede} ${styles.reveal} ${styles.d3}`}>
                      A framework-aware research companion for pastors, apologists, and
                      serious students. Every answer is shaped by your tradition,
                      grounded in church history, and tested against the strongest
                      arguments on the other side — no strawmen, no tribalism.
                    </p>
                    <form
                      onSubmit={handleWaitlist}
                      className={`${styles.waitlistForm} ${styles.reveal} ${styles.d4}`}
                    >
                      <div className={styles.emailInputWrapper}>
                        <input
                          type="email"
                          required
                          placeholder="your@email.com"
                          value={email}
                          onChange={(e) => !submitted && setEmail(e.target.value)}
                          disabled={submitted || isLoading}
                          className={styles.emailInput}
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={submitted || isLoading || !!alreadyRegistered}
                        className={`${styles.btnPrimary} ${submitted || alreadyRegistered ? styles.btnPrimarySuccess : ""}`}
                      >
                        {submitted
                          ? "You're on the list"
                          : alreadyRegistered
                            ? "Already registered"
                            : isLoading
                              ? "Joining…"
                              : (
                                <>
                                  Join Waitlist
                                  <span className={styles.arrow} aria-hidden>→</span>
                                </>
                              )}
                      </button>
                    </form>
                  </>
                )}

                {active === "why" && (
                  <>
                    <p className={`${styles.eyebrow} ${styles.reveal} ${styles.d1}`}>
                      Why Theologia
                    </p>
                    <div className={`${styles.whyTabs} ${styles.reveal} ${styles.d2}`}>
                      {WHY_FACETS.map((facet, i) => (
                        <button
                          key={facet.id}
                          onClick={() => setWhyFacet(i)}
                          className={`${styles.whyTab}${whyFacet === i ? ` ${styles.whyTabActive}` : ""}`}
                        >
                          {facet.label}
                        </button>
                      ))}
                    </div>
                    <div key={WHY_FACETS[whyFacet].id}>
                      <h1 className={`${styles.headline} ${styles.reveal} ${styles.d2}`}>
                        {WHY_FACETS[whyFacet].headline}
                      </h1>
                      <p className={`${styles.lede} ${styles.reveal} ${styles.d3}`}>
                        {WHY_FACETS[whyFacet].lede}
                      </p>
                    </div>
                  </>
                )}

                {active === "library" && (
                  <>
                    <p className={`${styles.eyebrow} ${styles.reveal} ${styles.d1}`}>
                      Primary sources
                    </p>
                    <h1 className={`${styles.headline} ${styles.reveal} ${styles.d2}`}>
                      The Fathers, the councils, the confessions — <em>in full</em>.
                    </h1>
                    <p className={`${styles.lede} ${styles.reveal} ${styles.d3}`}>
                      A searchable library of patristic writings, ecumenical council
                      documents, and confessional standards. Apostolic Fathers through
                      the Reformers. AI-assisted reading so you engage the source
                      directly, not a summary of a summary.
                    </p>
                  </>
                )}

                {active === "pricing" && (
                  <>
                    <p className={`${styles.eyebrow} ${styles.reveal} ${styles.d1}`}>
                      Plans
                    </p>
                    <h1 className={`${styles.headline} ${styles.reveal} ${styles.d2}`}>
                      Depth that scales with <em>your study</em>.
                    </h1>
                    <div className={`${styles.pricingCards} ${styles.reveal} ${styles.d3}`}>
                      {PRICING.map((p) => {
                        // The whole card is the link — no CTA row, so the
                        // cards keep their original height (no scroll) and
                        // the auth/product swap never changes the layout.
                        const product = p.productKey
                          ? products?.[p.productKey]
                          : null;
                        const card = (
                          <>
                            <p className={styles.pricingPlan}>{p.plan}</p>
                            <p className={styles.pricingPrice}>
                              {p.price}
                              <span className={styles.pricingPeriod}>
                                {p.period}
                              </span>
                            </p>
                            <p className={styles.pricingDesc}>{p.desc}</p>
                          </>
                        );
                        if (user && product) {
                          return (
                            <CheckoutLink
                              key={p.plan}
                              polarApi={api.polar}
                              productIds={[product.id]}
                              className={styles.pricingCard}
                            >
                              {card}
                            </CheckoutLink>
                          );
                        }
                        return (
                          <Link
                            key={p.plan}
                            href={user ? "/chat" : "/sign-up"}
                            className={styles.pricingCard}
                            aria-label={
                              p.productKey ? `Get ${p.plan}` : "Start free"
                            }
                          >
                            {card}
                          </Link>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className={`${styles.frameworks} ${styles.reveal} ${styles.d5}`}>
          <p className={styles.frameworkList}>
            {FRAMEWORKS.map((f, i) => (
              <span key={f}>
                {f}
                {i < FRAMEWORKS.length - 1 && (
                  <span className={styles.dot} aria-hidden>
                    ·
                  </span>
                )}
              </span>
            ))}
            <span className={styles.dot} aria-hidden>
              ·
            </span>
            <span className={styles.frameworkNote}>
              twelve traditions, each read on its own terms
            </span>
          </p>
        </div>
      </div>
    </section>
  );
}

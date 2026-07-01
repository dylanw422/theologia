"use client";
import { useState } from "react";
import Link from "next/link";

import styles from "./hero.module.css";

type ActiveSection = "frameworks" | "library" | "pricing" | null;

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
    desc: "20 queries/month · Framework Q&A",
  },
  {
    plan: "Scholar",
    price: "$19",
    period: "/mo",
    desc: "Unlimited Q&A · Devil's Advocate · Comparison · Resource Engine",
  },
  {
    plan: "Ministry",
    price: "$39",
    period: "/mo",
    desc: "All Scholar + Debate Prep · Catechism Tutor · Patristic Library · Scripture Study · Export",
  },
  {
    plan: "Church Team",
    price: "$99",
    period: "/mo",
    desc: "5 seats · All Ministry features · Shared notes & study sessions",
  },
] as const;

export default function Hero() {
  const [active, setActive] = useState<ActiveSection>(null);

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
            {(["frameworks", "library", "pricing"] as const).map((sec) => (
              <button
                key={sec}
                onClick={() => toggle(sec)}
                className={`${styles.navBtn}${active === sec ? ` ${styles.navBtnActive}` : ""}`}
              >
                {sec.charAt(0).toUpperCase() + sec.slice(1)}
              </button>
            ))}
            <Link href="/dashboard" className={styles.navSignIn}>
              Sign in
            </Link>
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
                    <div className={`${styles.actions} ${styles.reveal} ${styles.d4}`}>
                      <Link href="/dashboard" className={styles.btnPrimary}>
                        Start studying — free
                        <span className={styles.arrow} aria-hidden>
                          →
                        </span>
                      </Link>
                      <button
                        onClick={() => setActive("frameworks")}
                        className={styles.btnGhost}
                      >
                        Choose your tradition
                      </button>
                    </div>
                  </>
                )}

                {active === "frameworks" && (
                  <>
                    <p className={`${styles.eyebrow} ${styles.reveal} ${styles.d1}`}>
                      Framework-aware
                    </p>
                    <h1 className={`${styles.headline} ${styles.reveal} ${styles.d2}`}>
                      The same question, read through <em>your confession</em>.
                    </h1>
                    <p className={`${styles.lede} ${styles.reveal} ${styles.d3}`}>
                      A Reformed pastor and a Wesleyan pastor asking about Romans 9
                      aren't asking the same question — not really. Theologia honors
                      that. Select your tradition and every answer draws from your
                      confession, your hermeneutics, and the theologians who shaped
                      how your tradition reads Scripture. Internal debates within your
                      tradition are noted. Opposing views are given their strongest
                      argument, not a strawman.
                    </p>
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
                      {PRICING.map((p) => (
                        <div key={p.plan} className={styles.pricingCard}>
                          <p className={styles.pricingPlan}>{p.plan}</p>
                          <p className={styles.pricingPrice}>
                            {p.price}
                            <span className={styles.pricingPeriod}>{p.period}</span>
                          </p>
                          <p className={styles.pricingDesc}>{p.desc}</p>
                        </div>
                      ))}
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

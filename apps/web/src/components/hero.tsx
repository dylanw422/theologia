import Link from "next/link";

import styles from "./hero.module.css";

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
  "Anabaptist",
  "Dispensational",
] as const;

export default function Hero() {
  return (
    <section className={styles.hero}>
        <div className={styles.fresco} aria-hidden />
        <div className={styles.overlay} aria-hidden />
        <div className={styles.grain} aria-hidden />

        <div className={styles.shell}>
          <nav className={styles.nav}>
            <Link href="/" className={styles.wordmark}>
              Theologia
            </Link>
            <div className={styles.navLinks}>
              <Link href="/frameworks">Frameworks</Link>
              <Link href="/library">Library</Link>
              <Link href="/pricing">Pricing</Link>
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
                  <Link href="/frameworks" className={styles.btnGhost}>
                    Choose your tradition
                  </Link>
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

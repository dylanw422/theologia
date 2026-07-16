import Link from "next/link";

import BetaBadge from "./beta-badge";
import styles from "./auth-layout.module.css";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.root}>
      <div className={styles.fresco} aria-hidden />
      <div className={styles.overlay} aria-hidden />
      <div className={styles.grain} aria-hidden />
      <div className={styles.shell}>
        <nav className={styles.nav} aria-label="Site">
          <Link href="/" className={styles.wordmark}>
            Theologia
            <BetaBadge />
          </Link>
        </nav>
        <main className={styles.main}>
          <div className={styles.card}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

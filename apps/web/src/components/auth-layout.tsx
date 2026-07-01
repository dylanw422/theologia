import Link from "next/link";
import styles from "./auth-layout.module.css";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.root}>
      <div className={styles.fresco} aria-hidden />
      <div className={styles.overlay} aria-hidden />
      <div className={styles.grain} aria-hidden />
      <div className={styles.shell}>
        <nav className={styles.nav}>
          <Link href="/" className={styles.wordmark}>Theologia</Link>
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

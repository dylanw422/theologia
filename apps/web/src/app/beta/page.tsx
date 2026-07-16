import type { Metadata } from "next";

import styles from "./beta.module.css";

export const metadata: Metadata = {
  title: "Private Beta · Theologia",
  robots: { index: false, follow: false },
};

// Landing surface for the beta gate. Entry itself happens at /api/beta via a
// personal magic link; this page only greets an invitee or explains a link
// that didn't resolve. No form — there's nothing to type.
export default async function BetaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const invalid = error === "invalid";

  return (
    <main className={styles.root}>
      <div className={styles.glow} aria-hidden />
      <div className={styles.content}>
        <p className={styles.eyebrow}>Private Beta</p>
        {invalid ? (
          <>
            <h1 className={styles.headline}>
              This invitation link is <em>no longer valid</em>.
            </h1>
            <p className={styles.lede}>
              It may have expired or been revoked. Reply to your invitation
              email and we&rsquo;ll send you a fresh link.
            </p>
          </>
        ) : (
          <>
            <h1 className={styles.headline}>
              Theologia is in <em>private beta</em>.
            </h1>
            <p className={styles.lede}>
              Access is by personal invitation. Open the link we emailed you to
              enter. If you joined the waitlist, your invitation is on its way.
            </p>
          </>
        )}
      </div>
    </main>
  );
}

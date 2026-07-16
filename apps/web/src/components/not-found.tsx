"use client";

import Link from "next/link";

import { api } from "@theologia/backend/convex/_generated/api";
import { useQuery } from "convex/react";

import { useSiteAccess } from "@/lib/use-site-access";
import styles from "./not-found.module.css";

export default function NotFound() {
  const access = useSiteAccess();
  const user = useQuery(
    api.auth.getCurrentUser,
    access ? undefined : "skip",
  );
  const signedIn = access && !!user;
  const ctaHref = signedIn ? "/chat" : "/";
  const ctaLabel = signedIn
    ? "Return to your studies"
    : "Back to the beginning";

  return (
    <div className={styles.root}>
      <div className={styles.glow} aria-hidden />
      <div className={styles.grain} aria-hidden />
      <div className={styles.content}>
        <p className={`${styles.eyebrow} ${styles.reveal} ${styles.d1}`}>
          § 404
        </p>
        <h1 className={`${styles.headline} ${styles.reveal} ${styles.d2}`}>
          This page has been declared <em>apocryphal</em>.
        </h1>
        <p className={`${styles.lede} ${styles.reveal} ${styles.d3}`}>
          No manuscript survives at this address. The page you&rsquo;re
          looking for doesn&rsquo;t exist — or never made it into the canon.
        </p>
        <Link
          href={ctaHref}
          className={`${styles.cta} ${styles.reveal} ${styles.d3}`}
        >
          {ctaLabel}
          <span className={styles.arrow} aria-hidden>
            →
          </span>
        </Link>
      </div>
    </div>
  );
}

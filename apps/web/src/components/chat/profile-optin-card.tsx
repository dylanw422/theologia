"use client";

import Link from "next/link";
import { useState } from "react";

import { api } from "@theologia/backend/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";

import styles from "./profile-optin-card.module.css";

/**
 * The "explicit opt-in at first eligible conversation" touchpoint
 * (docs/THEOLOGICAL_PROFILE.md §User control). Shows only for paid users who
 * have never made a profile decision; either action records one through
 * setOptIn, so the card never reappears. /profile remains the place to
 * change your mind.
 */
export default function ProfileOptInCard() {
  const usage = useQuery(api.usage.getUsage);
  const decided = useQuery(api.profile.hasProfileDecision);
  const setOptIn = useMutation(api.profile.setOptIn);
  const [pending, setPending] = useState(false);

  // Hide on every doubt path: loading, signed out, free plan, or decided.
  if (!usage || usage.planId === "free" || decided !== false) return null;

  async function decide(optedIn: boolean) {
    if (pending) return;
    setPending(true);
    try {
      await setOptIn({ optedIn });
      if (optedIn) {
        toast.success("Your profile has begun — see Your Theology.");
      }
    } catch (error) {
      console.error("profile opt-in decision failed", error);
      toast.error("Could not save your choice. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={styles.overlay}>
      <aside
        className={styles.card}
        role="dialog"
        aria-modal="true"
        aria-label="Theological profile opt-in"
      >
        <h2 className={styles.title}>Keep a record of what you believe?</h2>
        <p className={styles.copy}>
          With your permission, Theologia records the positions you affirm in
          your own words — one sentence each, linked to the study where you
          took them — and the answers you receive draw on them, so each study
          builds on the last. Everything is editable, exportable, and
          deletable; never shared, never used in marketing, never used to train
          models.{" "}
          <Link href="/profile" className={styles.learnMore}>
            Learn more
          </Link>
        </p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primary}
            onClick={() => decide(true)}
            disabled={pending}
          >
            Begin my profile
          </button>
          <button
            type="button"
            className={styles.quiet}
            onClick={() => decide(false)}
            disabled={pending}
          >
            Not now
          </button>
        </div>
      </aside>
    </div>
  );
}

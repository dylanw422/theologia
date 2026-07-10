"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { api } from "@theologia/backend/convex/_generated/api";
import type { Id } from "@theologia/backend/convex/_generated/dataModel";
import { buildStudyPrompt } from "@theologia/backend/convex/lib/tensions";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { toast } from "sonner";

import { usageLimitMessage } from "@/components/chat/lib/usage-limit";

import styles from "./tensions-section.module.css";

type TensionsData = NonNullable<
  FunctionReturnType<typeof api.tensions.getTensions>
>;
type Tension = TensionsData["open"][number];

export default function TensionsSection() {
  const tensions = useQuery(api.tensions.getTensions);
  const resolveTension = useMutation(api.tensions.resolveTension);
  const dismissTension = useMutation(api.tensions.dismissTension);
  const createConversation = useMutation(api.chat.createConversation);
  const router = useRouter();

  const [resolvingId, setResolvingId] = useState<Id<"tensions"> | null>(null);
  const [resolutionDraft, setResolutionDraft] = useState("");
  const [studyingId, setStudyingId] = useState<Id<"tensions"> | null>(null);

  if (!tensions) return null;
  if (tensions.open.length === 0 && tensions.resolved.length === 0) return null;

  async function handleStudy(tension: Tension) {
    if (!tension.studyFramework) return;
    setStudyingId(tension.id);
    try {
      const conversationId = await createConversation({
        mode: "qa",
        setup: { framework: tension.studyFramework },
        firstMessage: buildStudyPrompt(
          tension.positionA.statement,
          tension.positionB.statement,
        ),
      });
      router.push(`/chat?c=${conversationId}`);
    } catch (error) {
      toast.error(
        usageLimitMessage(error) ?? "Couldn't start the study conversation.",
      );
      setStudyingId(null);
    }
  }

  async function handleResolve(tension: Tension) {
    try {
      await resolveTension({
        tensionId: tension.id,
        resolution: resolutionDraft,
      });
      setResolvingId(null);
      setResolutionDraft("");
    } catch {
      toast.error("Couldn't save your resolution. Please try again.");
    }
  }

  async function handleDismiss(tension: Tension) {
    try {
      await dismissTension({ tensionId: tension.id });
    } catch {
      toast.error("Couldn't dismiss this tension. Please try again.");
    }
  }

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionLabel}>Tensions</h2>
      <p className={styles.sectionLede}>
        Places where two things you have affirmed sit uneasily together — held
        up for study, not judgment.
      </p>

      {tensions.open.map((tension) => (
        <article key={tension.id} className={styles.card}>
          <blockquote className={styles.quote}>
            <p className={styles.statement}>{tension.positionA.statement}</p>
            <p className={styles.apparatus}>
              <Link
                href={`/chat?c=${tension.positionA.sourceConversationId}`}
                className={styles.sourceLink}
              >
                source conversation
              </Link>
            </p>
          </blockquote>
          <blockquote className={styles.quote}>
            <p className={styles.statement}>{tension.positionB.statement}</p>
            <p className={styles.apparatus}>
              <Link
                href={`/chat?c=${tension.positionB.sourceConversationId}`}
                className={styles.sourceLink}
              >
                source conversation
              </Link>
            </p>
          </blockquote>
          <p className={styles.description}>{tension.description}</p>
          {tension.historicalNote ? (
            <p className={styles.historicalNote}>{tension.historicalNote}</p>
          ) : null}

          {resolvingId === tension.id ? (
            <div className={styles.resolveRow}>
              <textarea
                aria-label="Resolution"
                className={styles.resolveArea}
                placeholder="In your own words, how did you resolve this?"
                value={resolutionDraft}
                onChange={(e) => setResolutionDraft(e.target.value)}
                rows={3}
              />
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.actionButton}
                  disabled={resolutionDraft.trim() === ""}
                  onClick={() => handleResolve(tension)}
                >
                  Save
                </button>
                <button
                  type="button"
                  className={styles.actionButton}
                  onClick={() => {
                    setResolvingId(null);
                    setResolutionDraft("");
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className={styles.actions}>
              {tension.studyFramework ? (
                <button
                  type="button"
                  className={styles.actionButton}
                  disabled={studyingId === tension.id}
                  onClick={() => handleStudy(tension)}
                >
                  {studyingId === tension.id ? "Opening…" : "Study this"}
                </button>
              ) : null}
              <button
                type="button"
                className={styles.actionButton}
                onClick={() => {
                  setResolvingId(tension.id);
                  setResolutionDraft("");
                }}
              >
                Resolved
              </button>
              <button
                type="button"
                className={styles.actionButton}
                onClick={() => handleDismiss(tension)}
              >
                Dismiss
              </button>
            </div>
          )}
        </article>
      ))}

      {tensions.resolved.length > 0 ? (
        <div className={styles.resolvedBlock}>
          <h3 className={styles.resolvedLabel}>Resolved</h3>
          {tensions.resolved.map((tension) => (
            <article key={tension.id} className={styles.resolvedItem}>
              {/* prettier-ignore */}
              <p className={styles.resolvedPair}>“{tension.positionA.statement}” · “{tension.positionB.statement}”</p>
              <p className={styles.resolution}>{tension.resolution}</p>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

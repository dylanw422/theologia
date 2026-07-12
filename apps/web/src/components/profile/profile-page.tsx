"use client";

import Link from "next/link";
import { useState } from "react";

import { api } from "@theologia/backend/convex/_generated/api";
import type { Id } from "@theologia/backend/convex/_generated/dataModel";
import { LOCI } from "@theologia/backend/convex/lib/profile";
import { getFramework } from "@theologia/backend/convex/lib/studyData";
import { useConvex, useMutation, useQuery } from "convex/react";
import { toast } from "sonner";

import Loader from "@/components/loader";

import { developmentLabel, topicHistories } from "./lib/development";
import styles from "./profile-page.module.css";
import TensionsSection from "./tensions-section";

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function ProfilePage() {
  const profile = useQuery(api.profile.getProfile);
  const setOptIn = useMutation(api.profile.setOptIn);
  const setPaused = useMutation(api.profile.setPaused);
  const editPosition = useMutation(api.profile.editPosition);
  const excludePosition = useMutation(api.profile.excludePosition);
  const deletePosition = useMutation(api.profile.deletePosition);
  const deleteAll = useMutation(api.profile.deleteAllProfileData);
  const convex = useConvex();

  const [editingId, setEditingId] = useState<Id<"positions"> | null>(null);
  const [draft, setDraft] = useState("");
  const [devOpenTopic, setDevOpenTopic] = useState<string | null>(null);

  if (profile === undefined) return <Loader />;
  if (profile === null) return null;

  const isFree = profile.planId === "free";
  const histories = topicHistories(profile.history ?? []);

  async function handleExport() {
    const markdown = await convex.query(api.profile.exportProfile, {});
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "your-theology.md";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleDeleteAll() {
    const ok = window.confirm(
      "Delete your entire theological profile? Every recorded position is removed permanently. This cannot be undone.",
    );
    if (!ok) return;
    await deleteAll({});
    toast.success("Your profile has been deleted.");
  }

  return (
    <div className={styles.root}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <Link href="/chat" className={styles.backLink}>
            ← Back to study
          </Link>
          <p className={styles.eyebrow}>Your Theology</p>
          <h1 className={styles.title}>
            A confession, <em>written by your own study</em>
          </h1>
          <p className={styles.lede}>
            Positions you have affirmed across your conversations, organized by
            the classical loci and sourced back to the study where you took
            them. Your studies read these positions too, so answers build on
            what you have already worked through. Yours to edit, export, or
            erase — never shared, never used in marketing, never used to train
            models.
          </p>
        </header>

        {isFree ? (
          <LockedPreview />
        ) : !profile.optedIn ? (
          <OptInCard onOptIn={() => setOptIn({ optedIn: true })} />
        ) : (
          <>
            <div className={styles.controls}>
              <label className={styles.pauseControl}>
                <input
                  type="checkbox"
                  checked={profile.paused}
                  onChange={(e) => setPaused({ paused: e.target.checked })}
                />
                Pause tracking
              </label>
              <button
                type="button"
                className={styles.controlButton}
                onClick={handleExport}
              >
                Export as markdown
              </button>
              <button
                type="button"
                className={styles.dangerButton}
                onClick={handleDeleteAll}
              >
                Delete everything
              </button>
            </div>

            <TensionsSection />

            <main className={styles.loci}>
              {LOCI.map((locus) => {
                const positions = profile.positions.filter(
                  (p) => p.locus === locus.id,
                );
                return (
                  <section key={locus.id} className={styles.locus}>
                    <h2
                      className={
                        positions.length === 0
                          ? styles.locusLabelEmpty
                          : styles.locusLabel
                      }
                    >
                      {locus.label}
                    </h2>
                    {positions.length === 0 ? (
                      <p className={styles.emptyLocus}>Nothing recorded yet.</p>
                    ) : (
                      positions.map((position) => (
                        <article key={position.id} className={styles.position}>
                          {editingId === position.id ? (
                            <div className={styles.editRow}>
                              <textarea
                                className={styles.editArea}
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                rows={2}
                              />
                              <div className={styles.positionActions}>
                                <button
                                  type="button"
                                  className={styles.controlButton}
                                  onClick={async () => {
                                    await editPosition({
                                      positionId: position.id,
                                      statement: draft,
                                    });
                                    setEditingId(null);
                                  }}
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  className={styles.controlButton}
                                  onClick={() => setEditingId(null)}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className={styles.statement}>
                              {position.statement}
                            </p>
                          )}
                          <p className={styles.apparatus}>
                            {[
                              position.stance,
                              position.strength,
                              position.frameworkAtTime
                                ? (getFramework(position.frameworkAtTime)
                                    ?.label ?? position.frameworkAtTime)
                                : null,
                              formatDate(position.createdAt),
                              position.userEdited ? "edited" : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                            {" · "}
                            <Link
                              href={`/chat?c=${position.sourceConversationId}`}
                              className={styles.sourceLink}
                            >
                              source conversation
                            </Link>
                          </p>
                          {(histories.get(position.topic)?.length ?? 0) > 1 && (
                            <div className={styles.development}>
                              <button
                                type="button"
                                className={styles.devToggle}
                                aria-expanded={devOpenTopic === position.topic}
                                aria-controls={`development-${position.topic}`}
                                onClick={() =>
                                  setDevOpenTopic(
                                    devOpenTopic === position.topic
                                      ? null
                                      : position.topic,
                                  )
                                }
                              >
                                development ·{" "}
                                {developmentLabel(histories.get(position.topic)!)}
                              </button>
                              {devOpenTopic === position.topic && (
                                <ol
                                  id={`development-${position.topic}`}
                                  className={styles.devList}
                                >
                                  {histories
                                    .get(position.topic)!
                                    .slice(0, -1)
                                    .map((entry) => (
                                      <li key={entry.id} className={styles.devItem}>
                                        <p className={styles.devStatement}>
                                          {entry.statement}
                                        </p>
                                        <p className={styles.apparatus}>
                                          {[
                                            entry.stance,
                                            entry.strength,
                                            entry.frameworkAtTime
                                              ? (getFramework(entry.frameworkAtTime)
                                                  ?.label ?? entry.frameworkAtTime)
                                              : null,
                                            formatDate(entry.createdAt),
                                            entry.userEdited ? "edited" : null,
                                          ]
                                            .filter(Boolean)
                                            .join(" · ")}
                                          {" · "}
                                          <Link
                                            href={`/chat?c=${entry.sourceConversationId}`}
                                            className={styles.sourceLink}
                                          >
                                            source conversation
                                          </Link>
                                        </p>
                                      </li>
                                    ))}
                                </ol>
                              )}
                            </div>
                          )}
                          {editingId !== position.id && (
                            <div className={styles.positionActions}>
                              <button
                                type="button"
                                className={styles.quietButton}
                                onClick={() => {
                                  setEditingId(position.id);
                                  setDraft(position.statement);
                                }}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className={styles.quietButton}
                                onClick={() =>
                                  excludePosition({
                                    positionId: position.id,
                                    excluded: true,
                                  })
                                }
                              >
                                Exclude
                              </button>
                              <button
                                type="button"
                                className={styles.quietButton}
                                onClick={() =>
                                  deletePosition({ positionId: position.id })
                                }
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </article>
                      ))
                    )}
                  </section>
                );
              })}
            </main>
          </>
        )}
      </div>
    </div>
  );
}

function LockedPreview() {
  return (
    <div className={styles.lockedWrap}>
      <p className={styles.lockedCopy}>
        Your Theology is part of the Scholar plan. As you study, Theologia
        assembles the positions you affirm into a living confession — each one
        dated, sourced to its conversation, and entirely under your control.
      </p>
      <div className={styles.lociLocked} aria-hidden="true">
        {LOCI.map((locus) => (
          <section key={locus.id} className={styles.locus}>
            <h2 className={styles.locusLabelEmpty}>{locus.label}</h2>
            <p className={styles.emptyLocus}>Fills in as you study.</p>
          </section>
        ))}
      </div>
    </div>
  );
}

function OptInCard({ onOptIn }: { onOptIn: () => void }) {
  return (
    <div className={styles.optInCard}>
      <h2 className={styles.optInTitle}>Keep a record of what you believe?</h2>
      <p className={styles.optInCopy}>
        With your permission, Theologia will read your finished conversations
        and record the theological positions you affirm in your own words — one
        sentence each, dated, and linked to the conversation where you took
        them. Only what you yourself affirm is recorded; never the
        assistant&apos;s views, never positions you argue against for practice.
        Your recorded positions are also read by your study companion when it
        answers you, so new study builds on ground you have already covered.
        Everything is editable and deletable, you can pause or export at any
        time, and your profile is never shared with anyone, never used in
        marketing, and never used to train models.
      </p>
      <button type="button" className={styles.optInButton} onClick={onOptIn}>
        Begin my profile
      </button>
      <p className={styles.optInFootnote}>
        Off by default. You can turn this off or delete everything at any time.
      </p>
    </div>
  );
}

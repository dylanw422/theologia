"use client";

import { BookOpen, PanelLeft } from "lucide-react";
import { useState } from "react";

import { api } from "@theologia/backend/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";

import BiblePanel from "@/components/bible/bible-panel";

import type { ComposerInsert } from "./chat-composer";
import ChatEmpty from "./chat-empty";
import ChatSidebar from "./chat-sidebar";
import ChatUpgradeBanner from "./chat-upgrade-banner";
import ChatUsageMeter from "./chat-usage-meter";
import LiveThread, { type LiveConversation } from "./live-thread";
import ProfileOptInCard from "./profile-optin-card";
import type { ConversationSetup, ModeId } from "./lib/chat-state";
import { usageLimitMessage } from "./lib/usage-limit";
import styles from "./chat-app.module.css";

export default function ChatApp() {
  const [activeId, setActiveId] = useState<string | null>(() =>
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search).get("c"),
  );
  const [bibleOpen, setBibleOpen] = useState(false);
  // Mobile-only drawer state; on desktop the sidebar is always in the grid.
  const [threadsOpen, setThreadsOpen] = useState(false);
  const [verseInsert, setVerseInsert] = useState<ComposerInsert | null>(null);

  function handleSendToChat(insert: { token: string; context: string }) {
    // A fresh id per send so the composer applies repeat selections too.
    setVerseInsert((prev) => ({ id: (prev?.id ?? 0) + 1, ...insert }));
  }

  const liveRows = useQuery(api.chat.listConversations);
  const createConversation = useMutation(api.chat.createConversation);

  const conversations: LiveConversation[] = (liveRows ?? []).map((row) => ({
    id: row._id,
    convexId: row._id,
    threadId: row.threadId,
    title: row.title,
    mode: row.mode,
    framework: row.framework,
    subTradition: row.subTradition,
    opposing: row.opposing,
    traditions: row.traditions,
    document: row.document,
    purpose: row.purpose,
    collection: row.collection,
    messages: [],
  }));

  const active = conversations.find((c) => c.id === activeId) ?? null;

  function handleSelect(id: string) {
    setActiveId(id);
    setThreadsOpen(false);
  }

  function handleNewChat() {
    setActiveId(null);
    setThreadsOpen(false);
  }

  async function handleStart(input: {
    mode: ModeId;
    setup: ConversationSetup;
    firstMessage: string;
  }) {
    try {
      const conversationId = await createConversation(input);
      setActiveId(conversationId);
    } catch (error) {
      toast.error(
        usageLimitMessage(error) ??
          "Could not start the study. Please try again.",
      );
    }
  }

  return (
    <div className={styles.root}>
      <div
        className={`${styles.shell}${bibleOpen ? ` ${styles.shellBible}` : ""}${threadsOpen ? ` ${styles.shellThreads}` : ""}`}
      >
        <ChatSidebar
          conversations={conversations}
          activeId={activeId}
          onSelect={handleSelect}
          onNewChat={handleNewChat}
        />
        {threadsOpen ? (
          <button
            type="button"
            className={styles.threadsScrim}
            aria-label="Close studies list"
            onClick={() => setThreadsOpen(false)}
          />
        ) : null}
        <main className={styles.main}>
          <div className={styles.fresco} aria-hidden />
          <div className={styles.overlay} aria-hidden />
          <div className={styles.grain} aria-hidden />
          {active === null ? <ChatUpgradeBanner /> : null}
          <div className={styles.content}>
            <ProfileOptInCard />
            {active ? (
              <LiveThread
                key={active.id}
                conversation={active}
                insert={verseInsert}
              />
            ) : (
              <ChatEmpty onStart={handleStart} insert={verseInsert} />
            )}
          </div>
          <button
            type="button"
            className={styles.threadsToggle}
            aria-label="Open studies list"
            aria-expanded={threadsOpen}
            onClick={() => setThreadsOpen(true)}
          >
            <PanelLeft size={16} strokeWidth={2} />
          </button>
          <button
            type="button"
            className={`${styles.bibleToggle}${bibleOpen ? ` ${styles.bibleToggleActive}` : ""}`}
            aria-label={bibleOpen ? "Close Bible reader" : "Open Bible reader"}
            aria-pressed={bibleOpen}
            onClick={() => setBibleOpen((open) => !open)}
          >
            <BookOpen size={16} strokeWidth={2} />
          </button>
          <ChatUsageMeter />
        </main>
        {bibleOpen ? (
          <BiblePanel
            onClose={() => setBibleOpen(false)}
            onSendToChat={handleSendToChat}
          />
        ) : null}
      </div>
    </div>
  );
}

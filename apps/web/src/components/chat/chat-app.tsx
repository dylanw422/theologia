"use client";

import { useState } from "react";

import { api } from "@theologia/backend/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";

import ChatEmpty from "./chat-empty";
import ChatSidebar from "./chat-sidebar";
import ChatUsageMeter from "./chat-usage-meter";
import LiveThread, { type LiveConversation } from "./live-thread";
import type { ConversationSetup, ModeId } from "./lib/chat-state";
import styles from "./chat-app.module.css";

export default function ChatApp() {
  const [activeId, setActiveId] = useState<string | null>(null);

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

  function handleNewChat() {
    setActiveId(null);
  }

  async function handleStart(input: {
    mode: ModeId;
    setup: ConversationSetup;
    firstMessage: string;
  }) {
    try {
      const conversationId = await createConversation(input);
      setActiveId(conversationId);
    } catch {
      toast.error("Could not start the study. Please try again.");
    }
  }

  return (
    <div className={styles.root}>
      <div className={styles.shell}>
        <ChatSidebar
          conversations={conversations}
          activeId={activeId}
          onSelect={setActiveId}
          onNewChat={handleNewChat}
        />
        <main className={styles.main}>
          <div className={styles.fresco} aria-hidden />
          <div className={styles.overlay} aria-hidden />
          <div className={styles.grain} aria-hidden />
          <div className={styles.content}>
            {active ? (
              <LiveThread key={active.id} conversation={active} />
            ) : (
              <ChatEmpty onStart={handleStart} />
            )}
          </div>
          <ChatUsageMeter />
        </main>
      </div>
    </div>
  );
}

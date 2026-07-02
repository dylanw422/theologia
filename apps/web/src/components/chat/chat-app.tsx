"use client";

import { useEffect, useRef, useState } from "react";

import { api } from "@theologia/backend/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";

import ChatEmpty from "./chat-empty";
import ChatSidebar from "./chat-sidebar";
import ChatThread from "./chat-thread";
import ChatUsageMeter from "./chat-usage-meter";
import LiveThread, { type LiveConversation } from "./live-thread";
import {
  appendMessage,
  withReply,
  type Action,
  type Conversation,
  type ConversationSetup,
  type ModeId,
} from "./lib/chat-state";
import { SEED_CONVERSATIONS } from "./lib/mock-chat";
import { getScript } from "./lib/scripts";
import styles from "./chat-app.module.css";

const REPLY_DELAY_MS = 900;

type ReplyOpts = { actionNext?: string; isFirst?: boolean };

export default function ChatApp() {
  // Mock seed conversations — untouched until live output is verified.
  const [mockConversations, setMockConversations] =
    useState<Conversation[]>(SEED_CONVERSATIONS);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isReplying, setIsReplying] = useState(false);
  const replyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const liveRows = useQuery(api.chat.listConversations);
  const createConversation = useMutation(api.chat.createConversation);

  useEffect(() => {
    return () => {
      if (replyTimer.current) clearTimeout(replyTimer.current);
    };
  }, []);

  const liveConversations: LiveConversation[] = (liveRows ?? []).map((row) => ({
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

  const sidebarConversations: Conversation[] = [
    ...liveConversations,
    ...mockConversations,
  ];

  const activeLive =
    liveConversations.find((c) => c.id === activeId) ?? null;
  const activeMock =
    mockConversations.find((c) => c.id === activeId) ?? null;

  function updateMockConversation(
    id: string,
    update: (conversation: Conversation) => Conversation,
  ) {
    setMockConversations((prev) =>
      prev.map((c) => (c.id === id ? update(c) : c)),
    );
  }

  // Scripted assistant response — mock threads only.
  function scheduleReply(id: string, opts: ReplyOpts) {
    setIsReplying(true);
    replyTimer.current = setTimeout(() => {
      updateMockConversation(id, (c) => withReply(c, getScript(c.mode), opts));
      setIsReplying(false);
    }, REPLY_DELAY_MS);
  }

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

  function handleMockSend(text: string) {
    if (!activeMock || isReplying) return;
    const id = activeMock.id;
    updateMockConversation(id, (c) =>
      appendMessage(c, { role: "user", content: text }),
    );
    scheduleReply(id, {});
  }

  function handleMockAction(action: Action) {
    if (!activeMock || isReplying) return;
    const id = activeMock.id;
    updateMockConversation(id, (c) =>
      appendMessage(c, { role: "user", content: action.prefill }),
    );
    scheduleReply(id, { actionNext: action.next });
  }

  return (
    <div className={styles.root}>
      <div className={styles.shell}>
        <ChatSidebar
          conversations={sidebarConversations}
          activeId={activeId}
          onSelect={setActiveId}
          onNewChat={handleNewChat}
        />
        <main className={styles.main}>
          <div className={styles.fresco} aria-hidden />
          <div className={styles.overlay} aria-hidden />
          <div className={styles.grain} aria-hidden />
          <div className={styles.content}>
            {activeLive ? (
              <LiveThread key={activeLive.id} conversation={activeLive} />
            ) : activeMock ? (
              <ChatThread
                conversation={activeMock}
                isReplying={isReplying}
                onSend={handleMockSend}
                onAction={handleMockAction}
              />
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

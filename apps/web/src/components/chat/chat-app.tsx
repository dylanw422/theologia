"use client";

import { useEffect, useRef, useState } from "react";

import ChatEmpty from "./chat-empty";
import ChatSidebar from "./chat-sidebar";
import ChatThread from "./chat-thread";
import {
  appendMessage,
  createConversation,
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
  const [conversations, setConversations] =
    useState<Conversation[]>(SEED_CONVERSATIONS);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isReplying, setIsReplying] = useState(false);
  const replyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (replyTimer.current) clearTimeout(replyTimer.current);
    };
  }, []);

  const activeConversation =
    conversations.find((c) => c.id === activeId) ?? null;

  function updateConversation(
    id: string,
    update: (conversation: Conversation) => Conversation,
  ) {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? update(c) : c)),
    );
  }

  // Scripted assistant response — swapped for real streaming in a later slice.
  function scheduleReply(id: string, opts: ReplyOpts) {
    setIsReplying(true);
    replyTimer.current = setTimeout(() => {
      updateConversation(id, (c) => withReply(c, getScript(c.mode), opts));
      setIsReplying(false);
    }, REPLY_DELAY_MS);
  }

  function handleNewChat() {
    setActiveId(null);
  }

  function handleStart(input: {
    mode: ModeId;
    setup: ConversationSetup;
    firstMessage: string;
  }) {
    const conversation = createConversation(input);
    setConversations((prev) => [conversation, ...prev]);
    setActiveId(conversation.id);
    scheduleReply(conversation.id, { isFirst: true });
  }

  function handleSend(text: string) {
    if (!activeConversation || isReplying) return;
    const id = activeConversation.id;
    updateConversation(id, (c) =>
      appendMessage(c, { role: "user", content: text }),
    );
    scheduleReply(id, {});
  }

  function handleAction(action: Action) {
    if (!activeConversation || isReplying) return;
    const id = activeConversation.id;
    updateConversation(id, (c) =>
      appendMessage(c, { role: "user", content: action.prefill }),
    );
    scheduleReply(id, { actionNext: action.next });
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
            {activeConversation ? (
              <ChatThread
                conversation={activeConversation}
                isReplying={isReplying}
                onSend={handleSend}
                onAction={handleAction}
              />
            ) : (
              <ChatEmpty onStart={handleStart} />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

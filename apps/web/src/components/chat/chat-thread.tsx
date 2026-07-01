"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import ChatComposer from "./chat-composer";
import type { Conversation } from "./lib/chat-state";
import { getFramework, getSubTradition } from "./lib/frameworks";
import styles from "./chat-thread.module.css";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      type="button"
      className={styles.copy}
      onClick={copy}
      aria-label={copied ? "Copied" : "Copy response"}
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
}

export default function ChatThread({
  conversation,
  isReplying,
  onSend,
}: {
  conversation: Conversation;
  isReplying: boolean;
  onSend: (text: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const frameworkLabel = getFramework(conversation.framework)?.label ?? "";
  const subLabel = conversation.subTradition
    ? getSubTradition(conversation.framework, conversation.subTradition)?.label
    : undefined;
  const traditionLabel = subLabel
    ? `${frameworkLabel} · ${subLabel}`
    : frameworkLabel;

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [conversation.messages.length, isReplying]);

  return (
    <div className={styles.thread}>
      <header className={styles.header}>
        <span className={styles.headerTitle}>{conversation.title}</span>
        <span className={styles.headerChip}>{traditionLabel}</span>
      </header>

      <div className={styles.scroll} ref={scrollRef}>
        <div className={styles.messages}>
          {conversation.messages.map((message) =>
            message.role === "user" ? (
              <div key={message.id} className={styles.userRow}>
                <div className={styles.userCard}>{message.content}</div>
              </div>
            ) : (
              <div key={message.id} className={styles.assistant}>
                <div className={styles.assistantHead}>
                  <span className={styles.assistantName}>Theologia</span>
                  <CopyButton text={message.content} />
                </div>
                <p className={styles.assistantBody}>{message.content}</p>
              </div>
            ),
          )}

          {isReplying ? (
            <div className={styles.assistant}>
              <div className={styles.assistantHead}>
                <span className={styles.assistantName}>Theologia</span>
              </div>
              <div className={styles.typing} aria-label="Composing a response">
                <span />
                <span />
                <span />
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className={styles.composerBar}>
        <div className={styles.composerInner}>
          <ChatComposer
            onSend={onSend}
            disabled={isReplying}
            context={<span className={styles.lockChip}>{traditionLabel}</span>}
          />
        </div>
      </div>
    </div>
  );
}

"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import ChatComposer from "./chat-composer";
import type { Action, Conversation } from "./lib/chat-state";
import { describeSetup, getMode } from "./lib/modes";
import MessageBlocks from "./message-blocks";
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
  onAction,
}: {
  conversation: Conversation;
  isReplying: boolean;
  onSend: (text: string) => void;
  onAction: (action: Action) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const modeLabel = getMode(conversation.mode).label;
  const setupLabel = describeSetup(conversation);
  const contextLabel = setupLabel
    ? `${modeLabel} · ${setupLabel}`
    : modeLabel;

  const lastMessage =
    conversation.messages[conversation.messages.length - 1];

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [conversation.messages.length, isReplying]);

  return (
    <div className={styles.thread}>
      <header className={styles.header}>
        <span className={styles.headerTitle}>{conversation.title}</span>
        <span className={styles.headerChip}>{contextLabel}</span>
      </header>

      <div className={styles.scroll} ref={scrollRef}>
        <div className={styles.messages}>
          {conversation.messages.map((message) => {
            if (message.role === "user") {
              return (
                <div key={message.id} className={styles.userRow}>
                  <div className={styles.userCard}>{message.content}</div>
                </div>
              );
            }

            const showActions =
              message === lastMessage &&
              !isReplying &&
              (message.actions?.length ?? 0) > 0;

            return (
              <div key={message.id} className={styles.assistant}>
                <div className={styles.assistantHead}>
                  <span className={styles.assistantName}>Theologia</span>
                  <CopyButton text={message.content} />
                </div>
                {message.blocks ? (
                  <MessageBlocks blocks={message.blocks} />
                ) : (
                  <p className={styles.assistantBody}>{message.content}</p>
                )}
                {showActions ? (
                  <div className={styles.actions}>
                    {message.actions?.map((action) => (
                      <button
                        key={action.id}
                        type="button"
                        className={styles.actionChip}
                        onClick={() => onAction(action)}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}

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
            context={<span className={styles.lockChip}>{contextLabel}</span>}
          />
        </div>
      </div>
    </div>
  );
}

"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@theologia/ui/components/message-scroller";

import ChatComposer, { type ComposerInsert } from "./chat-composer";
import ChatNavTrail from "./chat-nav-trail";
import ChatUpgradeBanner from "./chat-upgrade-banner";
import type { Action, Conversation } from "./lib/chat-state";
import { groupIntoExchanges } from "./lib/exchanges";
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
  isStreaming = false,
  onSend,
  onAction,
  insert = null,
}: {
  conversation: Conversation;
  isReplying: boolean;
  isStreaming?: boolean;
  onSend: (text: string) => void;
  onAction: (action: Action) => void;
  insert?: ComposerInsert | null;
}) {
  const modeLabel = getMode(conversation.mode).label;
  const setupLabel = describeSetup(conversation);
  const contextLabel = setupLabel
    ? `${modeLabel} · ${setupLabel}`
    : modeLabel;

  const exchanges = groupIntoExchanges(conversation.messages);
  const lastMessage =
    conversation.messages[conversation.messages.length - 1];

  return (
    <MessageScrollerProvider>
      <div className={styles.thread}>
        <header className={styles.header}>
          <span className={styles.headerTitle}>{conversation.title}</span>
          <span className={styles.headerChip}>{contextLabel}</span>
        </header>

        <ChatUpgradeBanner variant="inline" />

        <MessageScroller className={styles.scroller}>
          <MessageScrollerViewport className={styles.viewport}>
            <MessageScrollerContent className={styles.messagesContent}>
              {exchanges.map((exchange, i) => {
                const isLast = i === exchanges.length - 1;
                const showActions =
                  exchange.assistant === lastMessage &&
                  !isReplying &&
                  !isStreaming &&
                  (exchange.assistant?.actions?.length ?? 0) > 0;

                return (
                  <MessageScrollerItem
                    key={exchange.id}
                    messageId={exchange.id}
                    scrollAnchor={isLast && !isReplying}
                    className={styles.exchangeItem}
                  >
                    <div className={styles.userRow}>
                      <div className={styles.userCard}>
                        {exchange.user.content}
                      </div>
                    </div>

                    {exchange.assistant ? (
                      <div className={styles.assistant}>
                        <div className={styles.assistantHead}>
                          <span className={styles.assistantName}>
                            Theologia
                          </span>
                          <CopyButton text={exchange.assistant.content} />
                        </div>
                        {exchange.assistant.blocks ? (
                          <MessageBlocks blocks={exchange.assistant.blocks} />
                        ) : (
                          <p className={styles.assistantBody}>
                            {exchange.assistant.content}
                          </p>
                        )}
                        {showActions ? (
                          <div className={styles.actions}>
                            {exchange.assistant.actions?.map((action) => (
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
                    ) : null}
                  </MessageScrollerItem>
                );
              })}

              {isReplying ? (
                <MessageScrollerItem messageId="typing" scrollAnchor>
                  <div className={styles.assistant}>
                    <div className={styles.assistantHead}>
                      <span className={styles.assistantName}>Theologia</span>
                    </div>
                    <div
                      className={styles.typing}
                      aria-label="Composing a response"
                    >
                      <span />
                      <span />
                      <span />
                    </div>
                  </div>
                </MessageScrollerItem>
              ) : null}
            </MessageScrollerContent>
          </MessageScrollerViewport>

          <MessageScrollerButton
            direction="end"
            className={styles.scrollDown}
          />
          <ChatNavTrail exchanges={exchanges} />
        </MessageScroller>

        <div className={styles.composerBar}>
          <div className={styles.composerInner}>
            <ChatComposer
              onSend={onSend}
              disabled={isReplying || isStreaming}
              insert={insert}
              context={
                <span className={styles.lockChip}>{contextLabel}</span>
              }
            />
          </div>
        </div>
      </div>
    </MessageScrollerProvider>
  );
}

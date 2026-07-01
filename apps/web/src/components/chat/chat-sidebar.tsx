"use client";

import { Plus } from "lucide-react";
import Link from "next/link";

import UserMenu from "@/components/user-menu";

import type { Conversation } from "./lib/chat-state";
import { getFramework } from "./lib/frameworks";
import styles from "./chat-sidebar.module.css";

export default function ChatSidebar({
  conversations,
  activeId,
  onSelect,
  onNewChat,
}: {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
}) {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.head}>
        <Link href="/" className={styles.wordmark}>
          Theologia
        </Link>
        <button type="button" className={styles.newChat} onClick={onNewChat}>
          <Plus size={15} strokeWidth={2.25} />
          New study
        </button>
      </div>

      <p className={styles.indexLabel}>Studies</p>
      <nav className={styles.list} aria-label="Conversations">
        {conversations.map((conversation) => {
          const label = getFramework(conversation.framework)?.label ?? "";
          const isActive = conversation.id === activeId;
          return (
            <button
              key={conversation.id}
              type="button"
              className={`${styles.item} ${isActive ? styles.itemActive : ""}`}
              aria-current={isActive ? "true" : undefined}
              onClick={() => onSelect(conversation.id)}
            >
              <span className={styles.itemTitle}>{conversation.title}</span>
              <span className={styles.itemFramework}>{label}</span>
            </button>
          );
        })}
      </nav>

      <div className={styles.footer}>
        <UserMenu />
      </div>
    </aside>
  );
}

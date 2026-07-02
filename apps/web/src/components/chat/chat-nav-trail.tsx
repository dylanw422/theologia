"use client"

import {
  useMessageScroller,
  useMessageScrollerVisibility,
} from "@theologia/ui/components/message-scroller"

import type { Exchange } from "./lib/exchanges"
import styles from "./chat-nav-trail.module.css"

export default function ChatNavTrail({ exchanges }: { exchanges: Exchange[] }) {
  const { visibleMessageIds } = useMessageScrollerVisibility()
  const { scrollToMessage } = useMessageScroller()

  if (exchanges.length < 5) return null

  return (
    <nav className={styles.trail} aria-label="Conversation navigation">
      {exchanges.map((exchange) => {
        const isActive = visibleMessageIds.includes(exchange.id)
        const preview = exchange.user.content.length > 42
          ? exchange.user.content.slice(0, 42).trimEnd() + "…"
          : exchange.user.content
        return (
          <button
            key={exchange.id}
            type="button"
            className={`${styles.dot}${isActive ? ` ${styles.active}` : ""}`}
            aria-label={`Jump to exchange ${exchange.index + 1}: ${preview}`}
            aria-current={isActive ? "true" : undefined}
            onClick={() => scrollToMessage(exchange.id)}
          >
            <span className={styles.preview} aria-hidden="true">{preview}</span>
          </button>
        )
      })}
    </nav>
  )
}

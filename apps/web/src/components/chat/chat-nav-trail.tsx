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
        return (
          <button
            key={exchange.id}
            type="button"
            className={`${styles.dot}${isActive ? ` ${styles.active}` : ""}`}
            aria-label={`Jump to exchange ${exchange.index + 1}`}
            aria-current={isActive ? "true" : undefined}
            onClick={() => scrollToMessage(exchange.id)}
          />
        )
      })}
    </nav>
  )
}

# Chat Navigation Trail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a right-edge dot scrubber to ChatThread that tracks scroll position across exchanges and lets users click to jump.

**Architecture:** Migrate ChatThread's plain-div scroll to the `MessageScroller` primitive stack; group flat messages into exchange pairs via a new `groupIntoExchanges` helper; render a new `ChatNavTrail` component absolutely positioned inside `MessageScroller` that drives its dots from `useMessageScrollerVisibility` and jump-scrolls via `scrollToMessage`.

**Tech Stack:** React 18, Next.js 15, CSS Modules, Tailwind v4, Vitest, `@shadcn/react/message-scroller` (via `@theologia/ui/components/message-scroller`)

## Global Constraints

- Import MessageScroller primitives as `@theologia/ui/components/message-scroller`
- `MessageScrollerItem` registers items via `messageId` prop (not `id`) — `visibleMessageIds` returns these values
- Jump-scroll API is `scrollToMessage(messageId: string)` from `useMessageScroller()`
- `visibleMessageIds` is `string[]` — use `.includes()` not `.has()`
- Dev server runs on port 3001
- No new npm packages

---

## File Map

| File | Action |
|------|--------|
| `apps/web/src/components/chat/lib/exchanges.ts` | Create — pure helper `groupIntoExchanges` + `Exchange` type |
| `apps/web/src/components/chat/lib/exchanges.test.ts` | Create — Vitest unit tests |
| `apps/web/src/components/chat/chat-nav-trail.tsx` | Create — dot scrubber component |
| `apps/web/src/components/chat/chat-nav-trail.module.css` | Create — dot styles |
| `apps/web/src/components/chat/chat-thread.tsx` | Modify — swap scroll div → MessageScroller stack, wire ChatNavTrail |
| `apps/web/src/components/chat/chat-thread.module.css` | Modify — remove `.scroll`/`.messages`, add `.scroller`/`.viewport`/`.messagesContent`/`.exchangeItem` |

---

### Task 1: groupIntoExchanges helper

**Files:**
- Create: `apps/web/src/components/chat/lib/exchanges.ts`
- Create: `apps/web/src/components/chat/lib/exchanges.test.ts`

**Interfaces:**
- Produces: `Exchange` type and `groupIntoExchanges(messages: Message[]): Exchange[]` — consumed by Tasks 2 and 3

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/components/chat/lib/exchanges.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { groupIntoExchanges } from "./exchanges"
import type { Message } from "./chat-state"

const u = (id: string): Message => ({ id, role: "user", content: "Q" })
const a = (id: string): Message => ({ id, role: "assistant", content: "A" })

describe("groupIntoExchanges", () => {
  it("returns empty array for empty messages", () => {
    expect(groupIntoExchanges([])).toEqual([])
  })

  it("pairs user + assistant into one exchange", () => {
    const result = groupIntoExchanges([u("u1"), a("a1")])
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe("u1")
    expect(result[0].index).toBe(0)
    expect(result[0].user.id).toBe("u1")
    expect(result[0].assistant?.id).toBe("a1")
  })

  it("handles trailing user message with no reply yet", () => {
    const result = groupIntoExchanges([u("u1"), a("a1"), u("u2")])
    expect(result).toHaveLength(2)
    expect(result[1].assistant).toBeNull()
  })

  it("assigns sequential index values", () => {
    const msgs = [u("u1"), a("a1"), u("u2"), a("a2")]
    const result = groupIntoExchanges(msgs)
    expect(result[0].index).toBe(0)
    expect(result[1].index).toBe(1)
  })

  it("uses the user message id as exchange id", () => {
    const result = groupIntoExchanges([u("user-abc"), a("asst-xyz")])
    expect(result[0].id).toBe("user-abc")
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/web && npx vitest run src/components/chat/lib/exchanges.test.ts
```

Expected: FAIL with "Cannot find module './exchanges'"

- [ ] **Step 3: Implement groupIntoExchanges**

Create `apps/web/src/components/chat/lib/exchanges.ts`:

```ts
import type { Message } from "./chat-state"

export type Exchange = {
  id: string
  index: number
  user: Message
  assistant: Message | null
}

export function groupIntoExchanges(messages: Message[]): Exchange[] {
  const exchanges: Exchange[] = []
  for (let i = 0; i < messages.length; i += 2) {
    const user = messages[i]
    const assistant = messages[i + 1] ?? null
    exchanges.push({ id: user.id, index: exchanges.length, user, assistant })
  }
  return exchanges
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/web && npx vitest run src/components/chat/lib/exchanges.test.ts
```

Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/chat/lib/exchanges.ts apps/web/src/components/chat/lib/exchanges.test.ts
git commit -m "feat(chat): groupIntoExchanges helper for exchange-based nav trail"
```

---

### Task 2: ChatNavTrail component

**Files:**
- Create: `apps/web/src/components/chat/chat-nav-trail.tsx`
- Create: `apps/web/src/components/chat/chat-nav-trail.module.css`

**Interfaces:**
- Consumes: `Exchange` from `./lib/exchanges`; `useMessageScrollerVisibility`, `useMessageScroller` from `@theologia/ui/components/message-scroller`
- Produces: `default export ChatNavTrail({ exchanges: Exchange[] })` — consumed by Task 3

- [ ] **Step 1: Create the CSS module**

Create `apps/web/src/components/chat/chat-nav-trail.module.css`:

```css
.trail {
  position: absolute;
  right: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  z-index: 10;
  pointer-events: none;
}

.dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  border: none;
  padding: 0;
  background: var(--hairline);
  cursor: pointer;
  pointer-events: all;
  transition:
    background 200ms ease,
    transform 200ms ease;
}

.dot:hover {
  background: var(--stone);
}

.active {
  background: var(--gold);
  transform: scale(1.3);
}

.dot:focus-visible {
  outline: 1px solid var(--gold);
  outline-offset: 3px;
}
```

- [ ] **Step 2: Create the component**

Create `apps/web/src/components/chat/chat-nav-trail.tsx`:

```tsx
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
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/chat/chat-nav-trail.tsx apps/web/src/components/chat/chat-nav-trail.module.css
git commit -m "feat(chat): ChatNavTrail dot scrubber component"
```

---

### Task 3: Migrate ChatThread to MessageScroller + wire ChatNavTrail

**Files:**
- Modify: `apps/web/src/components/chat/chat-thread.tsx`
- Modify: `apps/web/src/components/chat/chat-thread.module.css`

**Interfaces:**
- Consumes: `groupIntoExchanges`, `Exchange` from `./lib/exchanges`; `MessageScrollerProvider`, `MessageScroller`, `MessageScrollerViewport`, `MessageScrollerContent`, `MessageScrollerItem`, `MessageScrollerButton` from `@theologia/ui/components/message-scroller`; `ChatNavTrail` from `./chat-nav-trail`

- [ ] **Step 1: Update chat-thread.module.css**

Remove `.scroll` and `.messages` blocks entirely. Add these new classes in their place (keep all other existing classes untouched):

```css
/* replaces .scroll */
.scroller {
  flex: 1;
  min-height: 0;
}

/* passed to MessageScrollerViewport to restore custom scrollbar color */
.viewport {
  scrollbar-color: var(--hairline) transparent;
}

/* passed to MessageScrollerContent — handles max-width, centering, padding */
.messagesContent {
  max-width: var(--measure);
  margin: 0 auto;
  padding: clamp(1.5rem, 4vh, 2.75rem) clamp(1.25rem, 4vw, 2.4rem);
}

/* passed to each MessageScrollerItem — stacks user bubble + assistant reply */
.exchangeItem {
  display: flex;
  flex-direction: column;
  gap: 2.1rem;
}
```

- [ ] **Step 2: Rewrite chat-thread.tsx**

Replace the full file contents:

```tsx
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

import ChatComposer from "./chat-composer";
import ChatNavTrail from "./chat-nav-trail";
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
  onSend,
  onAction,
}: {
  conversation: Conversation;
  isReplying: boolean;
  onSend: (text: string) => void;
  onAction: (action: Action) => void;
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

        <MessageScroller className={styles.scroller}>
          <MessageScrollerViewport className={styles.viewport}>
            <MessageScrollerContent className={styles.messagesContent}>
              {exchanges.map((exchange, i) => {
                const isLast = i === exchanges.length - 1;
                const showActions =
                  exchange.assistant === lastMessage &&
                  !isReplying &&
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

          <MessageScrollerButton direction="end" />
          <ChatNavTrail exchanges={exchanges} />
        </MessageScroller>

        <div className={styles.composerBar}>
          <div className={styles.composerInner}>
            <ChatComposer
              onSend={onSend}
              disabled={isReplying}
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
```

- [ ] **Step 3: Verify the build compiles**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Start the dev server and verify behavior**

```bash
cd apps/web && PORT=3001 npm run dev
```

Open http://localhost:3001/chat and check:

1. **Thread renders** — user bubbles right-aligned, assistant responses left-aligned, header and composer present
2. **Auto-scroll** — sending a new message scrolls to the bottom automatically (no manual `scrollTop` needed)
3. **Scroll-to-bottom button** — appears when you scroll up; clicking returns to bottom
4. **Nav trail hidden** — on a fresh conversation or any conversation with < 5 exchanges, no dots appear
5. **Nav trail visible** — open a seeded conversation from the sidebar that has 5+ exchanges; dots appear on the right edge
6. **Active dots** — dots corresponding to visible exchanges are gold; others are dim
7. **Click-to-jump** — clicking a dot scrolls to that exchange
8. **Typing indicator** — while reply is loading, typing dots appear and auto-scroll fires; no extra dot appears in the trail

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/chat/chat-thread.tsx apps/web/src/components/chat/chat-thread.module.css
git commit -m "feat(chat): migrate ChatThread to MessageScroller + wire nav trail"
```

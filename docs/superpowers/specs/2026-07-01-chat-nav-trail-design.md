# Chat Navigation Trail — Design Spec

**Date:** 2026-07-01
**Status:** Approved

## Summary

Add a right-edge dot scrubber to the chat thread that shows the user's position in a conversation and lets them jump to any exchange by clicking a dot. One dot per user+assistant exchange. Built on the `MessageScroller` primitive already in `packages/ui`.

---

## Architecture

`ChatThread` is refactored to use the full `MessageScrollerProvider` / `MessageScroller` / `MessageScrollerViewport` / `MessageScrollerContent` / `MessageScrollerItem` stack. The current plain `<div ref={scrollRef}>` and the `useEffect scrollTop = scrollHeight` imperative hack are deleted; MessageScroller's autoscroll replaces them.

New component `ChatNavTrail` is added alongside the thread, living inside the same `MessageScrollerProvider` context so it can access the visibility hook.

### Component tree

```
MessageScrollerProvider
  div.thread
    header
    MessageScroller                      (replaces div.scroll)
      MessageScrollerViewport
        MessageScrollerContent           (replaces div.messages)
          MessageScrollerItem [id=ex-0]
            userCard
            assistantBlock
          MessageScrollerItem [id=ex-1]
            ...
          MessageScrollerItem [id=ex-N, scrollAnchor=true]   ← last exchange
          MessageScrollerItem [id=typing]   ← only while isReplying
        MessageScrollerButton direction="end"   ← free scroll-to-bottom
    ChatNavTrail
    composerBar
```

---

## Exchange Grouping

Messages are paired into exchanges inline during render — no new state, no selector. Walk `conversation.messages` two at a time (user always precedes assistant, guaranteed by `appendMessage` + `withReply`):

```ts
const exchanges: Exchange[] = []
for (let i = 0; i < messages.length; i += 2) {
  const user = messages[i]
  const assistant = messages[i + 1] ?? null  // null while reply in flight
  exchanges.push({ id: user.id, index: exchanges.length, user, assistant })
}
```

The exchange `id` is the user message's `id` (already stable UUIDs from `chat-state.ts`).

---

## ChatNavTrail Component

**File:** `apps/web/src/components/chat/chat-nav-trail.tsx`
**CSS:** `apps/web/src/components/chat/chat-nav-trail.module.css`

### Props

```ts
type Exchange = { id: string; index: number }
function ChatNavTrail({ exchanges }: { exchanges: Exchange[] })
```

### Hooks used

```ts
const { visibleMessageIds } = useMessageScrollerVisibility()
const { scrollToMessage } = useMessageScroller()
```

`visibleMessageIds.includes(exchange.id)` drives each dot's active state.
`scrollToMessage(exchange.id)` is called on dot click.

### Render condition

Returns `null` when `exchanges.length < 5` — below that count the trail adds no navigational value.

### Positioning

`position: absolute; right: 0.75rem` inside the `MessageScrollerViewport` area, vertically centered with `top: 50%; transform: translateY(-50%)`. The content column is max-width 720px centered, so the trail lives in the right gutter without overlapping message text.

### Visual spec

| State    | Fill              | Scale |
|----------|-------------------|-------|
| Inactive | `var(--hairline)` | 1×    |
| Hover    | `var(--stone)`    | 1×    |
| Active   | `var(--gold)`     | 1.3×  |

- Dot size: 5px circle
- Gap between dots: 8px
- Transition: 200ms ease on fill and scale

### Accessibility

- Each dot: `<button aria-label="Jump to exchange {n + 1}">`
- Active dot: `aria-current="true"`

---

## Data Flow

```
conversation.messages
  → exchange grouping (render-time, no state)
  → MessageScrollerItem per exchange (id = user message id)
  → useMessageScrollerVisibility → visibleMessageIds (string[])
  → ChatNavTrail dot active state (visibleMessageIds.includes(id))
  → click → scrollToMessage(exchange.id)
```

---

## Edge Cases

| Case | Behavior |
|------|----------|
| < 5 exchanges | Trail not rendered |
| `isReplying` | Typing indicator in its own `MessageScrollerItem [id=typing]`, not in `exchanges`, no dot rendered for it |
| New conversation | Trail hidden until 5th exchange |
| Odd message count | Last user message paired with `assistant: null` — renders user bubble only, included in exchanges |

---

## Files Changed

| File | Change |
|------|--------|
| `apps/web/src/components/chat/chat-thread.tsx` | Swap plain div for MessageScroller stack; group messages into exchanges; render ChatNavTrail |
| `apps/web/src/components/chat/chat-thread.module.css` | Remove `.scroll`, update `.messages` to work as MessageScrollerContent |
| `apps/web/src/components/chat/chat-nav-trail.tsx` | New component |
| `apps/web/src/components/chat/chat-nav-trail.module.css` | New CSS module |

No changes to `chat-app.tsx`, `chat-state.ts`, or any other files.

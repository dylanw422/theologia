# Design: `/chat` — Framework-Aware Q&A shell (UI only)

**Date:** 2026-07-01
**Status:** Approved (design), pending implementation plan
**Scope:** First vertical slice of GOAL.md Feature #1 (Framework-Aware Q&A) — the **UI shell only**. No backend persistence, no AI.

---

## Goal

Replace the placeholder `/dashboard` route with a `/chat` route that presents the Framework-Aware Q&A interface as a fully styled, interactive **UI shell** driven by local/mock state. A user can browse mock conversations, start a new chat by choosing a theological framework, type a question, and see the thread respond with a canned assistant reply. No Convex persistence and no Anthropic/Claude integration in this pass.

This slice establishes the layout, component boundaries, and fresco-native visual language that later passes (persistence, streaming, real system prompts) will build on.

---

## Decisions (from brainstorming)

- **Scope:** UI shell first — route + full chat UI wired to local/mock state. Persistence + streaming come later.
- **Layout:** Sidebar + chat pane. Persistent left rail (conversation history, new chat, user). Main pane shows either the new-chat empty state or an active thread.
- **Framework selection:** Chosen on the new-chat screen only (framework + optional sub-tradition). Once a conversation has started, the framework is **displayed but not changeable** ("lock in your framework").
- **Styling:** CSS modules, fresco-native — apply `docs/DESIGN.md` (fresco background, gold/parchment tokens, Fraunces/Geist Mono/Inter). Use the scaffolded chat primitives structurally where they add behavior; override their look.
- **Sign-out redirect:** to `/` (not the gated `/chat`).
- **Thread rendering:** use the `MessageScroller` primitive for autoscroll/scroll-to-bottom behavior; hand-style message rows and bubbles with CSS modules rather than the Tailwind `bubble`/`message` primitives (whose shadcn tokens fight the manuscript aesthetic).

---

## A. Routing & file moves

- Move `apps/web/src/app/dashboard/page.tsx` → `apps/web/src/app/chat/page.tsx`.
- Repoint the four `/dashboard` references:
  - `apps/web/src/components/sign-in-form.tsx` — post-auth `router.push` → `/chat`.
  - `apps/web/src/components/sign-up-form.tsx` — post-auth `router.push` → `/chat`.
  - `apps/web/src/components/user-menu.tsx` — sign-out `router.push` → `/` (was `/dashboard`).
  - `apps/web/src/components/header.tsx` — nav entry `{ to: "/dashboard", label: "Dashboard" }` → `{ to: "/chat", label: "Chat" }`.
- Generated `.next/*` route types are ignored (regenerate on build).

## B. Component structure

All new chat components live under `apps/web/src/components/chat/`, each with a colocated `*.module.css`.

Auth gating stays exactly as the current dashboard page:

- `apps/web/src/app/chat/page.tsx`
  - `<Authenticated>` → `<ChatApp />`
  - `<Unauthenticated>` → `<AuthLayout>` + `<SignInForm />` (reuse existing)
  - `<AuthLoading>` → loader

Components:

- **`chat-app.tsx`** — client component, owns all state. Renders the fresco background layers (`fresco` / `overlay` / `grain`, reusing the DESIGN.md system) plus a two-column grid: `ChatSidebar` | main pane. Main pane conditionally renders `ChatEmpty` (new chat) or `ChatThread` (active conversation).
- **`chat-sidebar.tsx`** — wordmark (`Theologia`, Fraunces), "＋ New" button, conversation list (each row: title + small mono framework marker; active row highlighted in gold), and a footer hosting the existing `UserMenu`.
- **`chat-empty.tsx`** — new-chat view: Fraunces headline ("What will you study today?"), `FrameworkPicker`, `ChatComposer`, and a row of sample-prompt ghost chips that prefill the composer.
- **`chat-thread.tsx`** — top bar showing the locked framework as a gold `marker` eyebrow, the message list (via `MessageScroller`), and `ChatComposer` pinned at the bottom.
- **`framework-picker.tsx`** — framework dropdown (12 traditions) plus an optional sub-tradition control that appears after a framework is chosen.
- **`chat-composer.tsx`** — textarea + gold-arrow send button; frosted/hairline border going gold on focus per DESIGN.md. Shared by empty + thread. Submit on Enter (Shift+Enter for newline); disabled when empty.
- **`lib/frameworks.ts`** — the 12 frameworks + their sub-traditions, transcribed from GOAL.md.
- **`lib/chat-state.ts`** — pure state helpers (see C) + mock seed conversations + the canned assistant reply text.

### Thread rendering detail

Wrap the message list in the `MessageScroller` primitive (`packages/ui/src/components/message-scroller.tsx`) for autoscroll and the scroll-to-bottom button. Render each message row with CSS-module markup:

- **Assistant** — unfilled manuscript passage: parchment text, generous line-height, no bubble fill (optionally a hairline left rule). Reads like body copy, not a chat bubble.
- **User** — right-aligned, gold-hairline bordered bubble, mono "you" label.

## C. State & mock behavior (no backend)

All state lives in `ChatApp` via `useState`, mutated through pure functions in `lib/chat-state.ts` so the logic is unit-testable in isolation.

Data shapes:

```ts
type Role = "user" | "assistant";
interface Message { id: string; role: Role; content: string; }
interface Conversation {
  id: string;
  title: string;
  framework: string;          // framework id
  subTradition?: string;      // sub-tradition id
  messages: Message[];
}
```

Pure helpers (exact signatures finalized in the plan):

- `createConversation({ framework, subTradition, firstMessage }) => Conversation` — derives `title` from the first message (truncated), seeds `messages` with the user turn.
- `appendMessage(conversation, message) => Conversation` — returns a new conversation with the message appended (immutable).
- `deriveTitle(text) => string` — first ~N chars / first line, trimmed.

Behavior:

- **＋ New** → clears the active conversation, shows `ChatEmpty`.
- Picking a framework (+ optional sub) and sending the first message → `createConversation(...)`, switch to thread view, prepend to sidebar list, then append the canned assistant reply after a short fake delay (with a brief "typing" indicator).
- Selecting a sidebar row → shows that conversation's thread.
- Sending in an existing thread → `appendMessage` the user turn, then the canned assistant reply after the fake delay.
- **Seed:** 2–3 mock conversations (varied frameworks) so the sidebar and thread look populated on first load.
- No network, no persistence — state resets on reload.

## D. Design-system application (`docs/DESIGN.md`)

- Fresco background (candlelit image, layered overlay vignette, film grain) behind the whole app; parent sets `position: relative; isolation: isolate; overflow: hidden`.
- Gold used sparingly: send arrow, active sidebar row, framework marker, focus rings. No large gold fills.
- Type roles: Fraunces (headline, wordmark), Geist Mono (nav, framework labels/markers, timestamps, the apparatus), Inter (message body / lede).
- 2px radii everywhere, `1px` `--hairline` dividers, deep near-black surfaces, content emerging from the vignette.
- All decorative motion (drift, reveals, hovers) wrapped in `prefers-reduced-motion` guards; register stays slow and reverent.

## E. Testing

The repo currently has **no test runner** (no Vitest/Jest, no test files). This slice introduces the first one:

- **Add Vitest to `apps/web`** — dev dependency, a minimal `vitest.config.ts`, and a `test` script. Scoped to the web app; not a repo-wide testing initiative.
- **Unit tests (pure logic only):**
  - `lib/chat-state.ts` — `createConversation`, `appendMessage` (immutability), `deriveTitle`.
  - `lib/frameworks.ts` — sanity test that the framework list matches the 12 GOAL.md traditions and each declared sub-tradition is present.
- **Manual:** visual + interaction verification against the running app (`next dev`, port 3001): new chat → pick framework → send → thread renders → canned reply → sidebar updates → switch conversations.

Rationale: the pure `chat-state` helpers are the only non-trivial logic in a UI-shell pass and are cheaply testable; everything else is visual and verified by hand. If introducing a test runner now is unwanted, the fallback is to rely on TypeScript typechecking + manual verification for this pass and defer tests to the persistence slice.

---

## Out of scope (this pass)

Explicitly deferred to later slices:

- Convex `conversations` / `messages` schema and persistence.
- Anthropic/Claude streaming and real framework system prompts.
- Attachments, message edit/regenerate, reactions.
- Church-history surfacing, devil's advocate, comparison, and other GOAL.md features.

---

## Affected / new files (summary)

**Moved:** `app/dashboard/page.tsx` → `app/chat/page.tsx`
**Edited:** `sign-in-form.tsx`, `sign-up-form.tsx`, `user-menu.tsx`, `header.tsx`
**New:** `components/chat/chat-app.tsx`, `chat-sidebar.tsx`, `chat-empty.tsx`, `chat-thread.tsx`, `framework-picker.tsx`, `chat-composer.tsx` (+ `*.module.css` each), `components/chat/lib/frameworks.ts`, `components/chat/lib/chat-state.ts`, and their tests.

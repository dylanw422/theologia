# Bible Reader Side Panel — Design

**Date:** 2026-07-06
**Status:** Approved

## Summary

Add a small book icon near the top of the chat screen that opens a Bible
reader as a side panel next to the chat thread. Users can read scripture
side by side with their study conversation. Text comes from a free,
keyless API serving public-domain translations. No backend involvement.

## Trigger

- A `BookOpen` icon button (lucide, already a dependency) pinned to the
  top-right of the chat main area.
- Rendered at the `ChatApp` level (`apps/web/src/components/chat/chat-app.tsx`)
  so it is present in both the empty state (`ChatEmpty`) and an active
  thread (`LiveThread`).
- Styled gold-on-ink to match the existing chip/hairline system
  (`--gold`, `--hairline` custom properties in `chat-app.module.css`).
- Clicking toggles the panel. The icon shows an active state while the
  panel is open. `aria-label="Open Bible reader"` / `"Close Bible reader"`.

## Panel layout

- Open/closed state is a `useState` in `ChatApp`.
- Desktop: the `.shell` grid gains a third column when open —
  `grid-template-columns: clamp(240px, 22vw, 288px) minmax(0, 1fr) clamp(320px, 26vw, 400px)`.
  Chat and scripture sit side by side; no overlay, chat remains fully
  interactive.
- Below the existing 760px breakpoint: the panel renders as a full-width
  layer over the chat instead of a grid column.
- Panel chrome follows the parchment/gold aesthetic:
  - Header row: book select, chapter select, translation select
    (WEB / KJV / ASV), close button.
  - Body: scrollable chapter text, superscript verse numbers, serif
    reading style consistent with assistant message rendering.
  - Footer: previous / next chapter buttons; these cross book boundaries
    (e.g. next from Malachi 4 goes to Matthew 1) and disable at
    Genesis 1 / Revelation 22.

## Persistence

- Last-read book, chapter, and translation persist in `localStorage`
  (single JSON key, e.g. `theologia.bible-reader`).
- Reopening the panel restores that position. Default: John 1, WEB.
- Corrupt or missing stored state falls back to the default silently.

## Data

- Client-side fetch from `https://bible-api.com/{book}+{chapter}?translation={id}`.
  Keyless, free, serves public-domain texts (World English Bible, KJV, ASV).
- `lib/books.ts`: static list of the 66 books with canonical names and
  chapter counts. Drives the pickers and prev/next navigation.
- Fetched chapters cached in a per-session in-memory `Map` keyed by
  `translation/book/chapter`, so revisiting a chapter is instant.
- No Convex, no server route, no API key.

## New files

Under `apps/web/src/components/bible/`:

| File | Purpose |
| --- | --- |
| `bible-panel.tsx` | Panel component: header controls, chapter body, prev/next footer |
| `bible-panel.module.css` | Panel styles (parchment/gold system) |
| `lib/books.ts` | 66-book metadata + prev/next chapter navigation helpers |
| `lib/books.test.ts` | Tests for navigation helpers (boundaries, book crossings) |
| `lib/use-chapter.ts` | Fetch/cache hook; response parsing kept in a pure function |
| `lib/use-chapter.test.ts` | Tests for the pure response-parsing function |

Modified: `chat-app.tsx` and `chat-app.module.css` (toggle button, third
grid column, mobile overlay).

## Error handling

- Fetch failure: inline "Couldn't load this chapter" message with a
  retry button inside the panel body. The chat is never affected.
- In-flight: lightweight skeleton using the existing `Skeleton` component
  from `@theologia/ui`.

## Testing

- Vitest, colocated per repo convention.
- `books.test.ts`: chapter counts sane, prev/next navigation across book
  boundaries, disabled at canon edges.
- `use-chapter.test.ts`: parsing of the bible-api.com response shape into
  the panel's verse list, including malformed-response handling.

## Out of scope (v1)

- Inserting verses into the chat composer.
- Search, cross-references, footnotes.
- Licensed translations (ESV, NIV) or any keyed API.
- Bundling Bible text into the repo.

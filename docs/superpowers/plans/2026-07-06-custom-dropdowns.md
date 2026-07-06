# Custom Dropdown Menus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every native `<select>` popup with a custom-styled dropdown via one shared `ChipSelect` component built on Base UI's Select primitive.

**Architecture:** `ChipSelect` renders the whole chip (border, label, caret) as a Base UI `Select.Trigger` and a portalled, ink/gold-styled popup. Three consumers migrate to it: `framework-picker.tsx`, `setup-picker.tsx` (its internal `SelectChip`), and `bible-panel.tsx`. No state or backend changes — the same ids flow to the same `onChange` handlers.

**Tech Stack:** `@base-ui/react/select` (v1.x, already in the workspace via `@theologia/ui`), CSS modules, lucide-react, bun workspaces.

**Spec:** `docs/superpowers/specs/2026-07-06-custom-dropdowns-design.md`

## Global Constraints

- Package manager is **bun** (`bun.lock`, `packageManager: bun@1.3.10`). Add deps by editing `package.json` then running `bun install` at the repo root.
- `@base-ui/react` version: `"^1.0.0"` (matches `packages/ui`).
- The popup portals to `document.body`, outside the chat `.root` that defines the palette custom properties — `chip-select.module.css` must re-declare the tokens it uses on both the chip and the positioner.
- Base UI Select quirks that MUST be handled: `Select.Positioner` needs `alignItemWithTrigger={false}` (default overlays the popup on the trigger, macOS-style); `onValueChange` can deliver `null` (coerce to `""`); `Select.ItemIndicator` renders only for the selected item, so rows need reserved indicator space (absolute positioning) or text misaligns.
- Verification commands run from `apps/web/`: `pnpm exec tsc --noEmit`, `pnpm test`. There are no new unit tests (component is presentational; vitest is node-env) — runtime verification is Task 4.
- Commit after every task with `feat(web):` / `refactor(web):` prefixes.

---

### Task 1: `ChipSelect` component

**Files:**
- Modify: `apps/web/package.json` (add dependency)
- Create: `apps/web/src/components/chip-select.tsx`
- Create: `apps/web/src/components/chip-select.module.css`

**Interfaces:**
- Consumes: `@base-ui/react/select`, lucide icons.
- Produces (used by Tasks 2–3):
  - `interface ChipSelectOption { id: string; label: string }`
  - `default export ChipSelect(props: { value: string; onChange: (id: string) => void; ariaLabel: string; options: ChipSelectOption[]; placeholder?: string; allowEmpty?: boolean; className?: string })`
  - Behavior: trigger shows the selected option's label (gold) or `placeholder` (dim); when `allowEmpty` is true and `placeholder` is set, the popup includes a selectable `""` row that clears the value.

- [ ] **Step 1: Add the dependency**

In `apps/web/package.json`, add to `dependencies` (alphabetical, right before `"@convex-dev/agent"`):

```json
    "@base-ui/react": "^1.0.0",
```

Run (from repo root): `bun install`
Expected: exits 0.

- [ ] **Step 2: Write the styles**

Create `apps/web/src/components/chip-select.module.css`:

```css
/* Chip-styled select (mirrors the composer's tradition chip) with a
   custom Base UI popup. The popup portals to document.body — outside
   the chat .root that defines the palette — so the tokens used here
   are re-declared locally on both the chip and the positioner. */

.chip,
.positioner {
  --ink-deep: #0b0805;
  --parchment: #f1e8d6;
  --parchment-dim: #b9a886;
  --stone: #8a7d68;
  --gold: #c9a24e;
  --gold-bright: #e6c984;
  --hairline: rgba(201, 162, 78, 0.26);
}

.chip {
  position: relative;
  display: inline-flex;
  align-items: center;
  min-width: 0;
  max-width: 100%;
  background: transparent;
  border: 1px solid var(--hairline);
  border-radius: 2px;
  padding: 0.5rem 1.7rem 0.5rem 0.75rem;
  font-family: var(--font-geist-mono), monospace;
  font-size: 0.74rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--parchment-dim);
  cursor: pointer;
  transition: border-color 0.22s ease;
}
.chip:hover,
.chip:focus-visible,
.chip[data-popup-open] {
  border-color: rgba(201, 162, 78, 0.55);
  outline: none;
}
.chipSet {
  color: var(--gold);
}

.label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.caret {
  position: absolute;
  right: 0.5rem;
  color: var(--stone);
  pointer-events: none;
}

.positioner {
  z-index: 50;
  outline: none;
}

.popup {
  box-sizing: border-box;
  max-height: min(20rem, var(--available-height));
  overflow-y: auto;
  padding: 0.25rem;
  background: #120e08;
  border: 1px solid var(--hairline);
  border-radius: 2px;
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.55);
  scrollbar-color: var(--hairline) transparent;
}

.item {
  position: relative;
  display: flex;
  align-items: center;
  padding: 0.45rem 0.75rem 0.45rem 1.5rem;
  border-radius: 2px;
  font-family: var(--font-geist-mono), monospace;
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--parchment);
  cursor: pointer;
  user-select: none;
  outline: none;
}
.item[data-highlighted] {
  color: var(--gold-bright);
  background: rgba(201, 162, 78, 0.09);
}

/* Renders only for the selected item — absolutely positioned so
   unselected rows keep the same text alignment. */
.indicator {
  position: absolute;
  left: 0.4rem;
  display: inline-flex;
  color: var(--gold);
}
```

- [ ] **Step 3: Write the component**

Create `apps/web/src/components/chip-select.tsx`:

```tsx
"use client";

import { Select } from "@base-ui/react/select";
import { Check, ChevronDown } from "lucide-react";

import styles from "./chip-select.module.css";

export interface ChipSelectOption {
  id: string;
  label: string;
}

function ChipItem({ value, label }: { value: string; label: string }) {
  return (
    <Select.Item value={value} className={styles.item}>
      <Select.ItemIndicator className={styles.indicator}>
        <Check size={11} aria-hidden />
      </Select.ItemIndicator>
      <Select.ItemText>{label}</Select.ItemText>
    </Select.Item>
  );
}

/** Chip-styled select with a custom popup (replaces native <select>). */
export default function ChipSelect({
  value,
  onChange,
  ariaLabel,
  options,
  placeholder,
  allowEmpty = false,
  className,
}: {
  value: string;
  onChange: (id: string) => void;
  ariaLabel: string;
  options: ChipSelectOption[];
  placeholder?: string;
  allowEmpty?: boolean;
  className?: string;
}) {
  const current = options.find((option) => option.id === value);

  return (
    <Select.Root
      value={value}
      onValueChange={(next) => onChange(typeof next === "string" ? next : "")}
    >
      <Select.Trigger
        className={`${styles.chip}${current ? ` ${styles.chipSet}` : ""}${className ? ` ${className}` : ""}`}
        aria-label={ariaLabel}
      >
        <span className={styles.label}>
          {current?.label ?? placeholder ?? ""}
        </span>
        <ChevronDown className={styles.caret} size={12} aria-hidden />
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner
          className={styles.positioner}
          align="start"
          sideOffset={4}
          alignItemWithTrigger={false}
        >
          <Select.Popup className={styles.popup}>
            {allowEmpty && placeholder ? (
              <ChipItem value="" label={placeholder} />
            ) : null}
            {options.map((option) => (
              <ChipItem key={option.id} value={option.id} label={option.label} />
            ))}
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}
```

- [ ] **Step 4: Typecheck**

Run (from `apps/web/`): `pnpm exec tsc --noEmit`
Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add apps/web/package.json bun.lock apps/web/src/components/chip-select.tsx apps/web/src/components/chip-select.module.css
git commit -m "feat(web): ChipSelect — custom dropdown on Base UI Select"
```

---

### Task 2: Migrate the composer pickers

**Files:**
- Modify: `apps/web/src/components/chat/framework-picker.tsx` (whole file)
- Modify: `apps/web/src/components/chat/framework-picker.module.css` (remove chip/select/caret rules)
- Modify: `apps/web/src/components/chat/setup-picker.tsx:1-49` (imports + `SelectChip`)
- Modify: `apps/web/src/components/chat/setup-picker.module.css` (remove chip/select/caret rules)

**Interfaces:**
- Consumes: `ChipSelect` default export from `@/components/chip-select` (Task 1) — `{ value, onChange, ariaLabel, options, placeholder?, allowEmpty?, className? }`.
- Produces: unchanged public components — `FrameworkPicker({ framework, onFrameworkChange })` and `SetupPicker({ mode, setup, onChange })`.

- [ ] **Step 1: Rewrite `framework-picker.tsx`**

Replace the entire file with:

```tsx
"use client";

import ChipSelect from "@/components/chip-select";

import { FRAMEWORKS } from "./lib/frameworks";

/**
 * Compact tradition selector, styled as a chip so it can live inside the
 * composer's context row.
 */
export default function FrameworkPicker({
  framework,
  onFrameworkChange,
}: {
  framework: string;
  onFrameworkChange: (id: string) => void;
}) {
  return (
    <ChipSelect
      value={framework}
      onChange={onFrameworkChange}
      ariaLabel="Tradition"
      placeholder="Tradition…"
      options={FRAMEWORKS}
    />
  );
}
```

(`FRAMEWORKS` entries carry extra fields beyond `{ id, label }` — that's fine, `ChipSelectOption[]` accepts structurally wider element types when passed as a variable.)

- [ ] **Step 2: Clean `framework-picker.module.css`**

Delete the `.chip`, `.chipSet`, `.select`, `.select option`, and `.caret` rules (and their hover/focus variants). If nothing else remains in the file, delete the file entirely — the component no longer imports it.

- [ ] **Step 3: Replace `SelectChip` in `setup-picker.tsx`**

Replace the imports and delete the whole `SelectChip` helper (lines 1–49) so the file starts:

```tsx
"use client";

import { X } from "lucide-react";

import ChipSelect from "@/components/chip-select";

import FrameworkPicker from "./framework-picker";
import type { ConversationSetup, ModeId } from "./lib/chat-state";
import { FRAMEWORKS, getFramework } from "./lib/frameworks";
import { COLLECTIONS, DOCUMENTS, PURPOSES, getMode } from "./lib/modes";
import styles from "./setup-picker.module.css";

const MAX_TRADITIONS = 4;
```

Then replace every `<SelectChip … />` usage in the `switch` with `<ChipSelect … />`. The prop names are identical (`value`, `onChange`, `ariaLabel`, `placeholder`, `options`, `allowEmpty`) and every options array (`FRAMEWORKS`, `DOCUMENTS`, `COLLECTIONS`, `PURPOSES`, and the `FRAMEWORKS.filter(...)` expressions) is already `{ id, label, … }[]` — pass them through unchanged. It is a pure component-name swap, five occurrences.

- [ ] **Step 4: Clean `setup-picker.module.css`**

Delete the `.chip`, `.chipSet .select`, `.chip:hover/.chip:focus-within`, `.select`, `.select option`, and `.caret` rules. Keep `.versus` and `.selected` (and its hover/focus rules) — they're still used.

- [ ] **Step 5: Typecheck and run the suite**

Run (from `apps/web/`): `pnpm exec tsc --noEmit && pnpm test`
Expected: typecheck exits 0; all vitest suites PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/chat/framework-picker.tsx apps/web/src/components/chat/framework-picker.module.css apps/web/src/components/chat/setup-picker.tsx apps/web/src/components/chat/setup-picker.module.css
git commit -m "refactor(web): composer pickers use ChipSelect custom dropdowns"
```

(Use `git rm` for `framework-picker.module.css` if Step 2 deleted it.)

---

### Task 3: Migrate the Bible panel selects

**Files:**
- Modify: `apps/web/src/components/bible/bible-panel.tsx` (header selects)
- Modify: `apps/web/src/components/bible/bible-panel.module.css` (remove chip/select/caret rules, keep `.bookChip`)

**Interfaces:**
- Consumes: `ChipSelect` from `@/components/chip-select` (Task 1); existing `BOOKS`, `TRANSLATIONS`, `TranslationId`, `reader` state.
- Produces: unchanged `BiblePanel({ onClose })`.

- [ ] **Step 1: Swap the three header selects**

In `bible-panel.tsx`: remove `ChevronDown` from the lucide import (keep `ChevronLeft, ChevronRight, X`), add `import ChipSelect from "@/components/chip-select";`, and replace the three `<span className={styles.chip}>…</span>` blocks inside `<header className={styles.head}>` with:

```tsx
        <ChipSelect
          className={styles.bookChip}
          value={reader.book}
          onChange={(id) =>
            setReader((r) => ({ ...r, book: id, chapter: 1 }))
          }
          ariaLabel="Book"
          options={BOOKS.map((b) => ({ id: b.name, label: b.name }))}
        />
        <ChipSelect
          value={String(reader.chapter)}
          onChange={(id) => setReader((r) => ({ ...r, chapter: Number(id) }))}
          ariaLabel="Chapter"
          options={Array.from({ length: book.chapters }, (_, i) => ({
            id: String(i + 1),
            label: String(i + 1),
          }))}
        />
        <ChipSelect
          value={reader.translation}
          onChange={(id) =>
            setReader((r) => ({ ...r, translation: id as TranslationId }))
          }
          ariaLabel="Translation"
          options={[...TRANSLATIONS]}
        />
```

The close button stays as-is after the three chips.

- [ ] **Step 2: Clean `bible-panel.module.css`**

Delete the `.chip`, `.chip:hover/.chip:focus-within`, `.select`, `.select option`, and `.caret` rules. Keep `.bookChip { flex: 1; }` — it's passed to `ChipSelect` for sizing. Keep everything else (head, body, verses, loading, error, foot, mobile overlay).

- [ ] **Step 3: Typecheck and run the suite**

Run (from `apps/web/`): `pnpm exec tsc --noEmit && pnpm test`
Expected: typecheck exits 0; all vitest suites PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/bible/bible-panel.tsx apps/web/src/components/bible/bible-panel.module.css
git commit -m "refactor(web): Bible panel selects use ChipSelect custom dropdowns"
```

---

### Task 4: Runtime verification

**Files:** none (verification only; fix-forward commits if issues surface).

- [ ] **Step 1: Verify in the running app**

Against the dev server (port 3001), signed in:

1. Empty chat state: open the mode that shows the tradition picker → clicking the chip opens the **custom** popup (ink surface, gold highlight), not the OS menu. Select a tradition → chip turns gold with the label.
2. "Versus" mode: opposing-tradition dropdown excludes the chosen tradition; picking works.
3. Collection mode (`allowEmpty`): the placeholder row ("All collections") is selectable and clears the value.
4. Bible panel: book dropdown scrolls (66 items) within its max-height; picking a book resets to chapter 1; chapter and translation dropdowns work; selected item shows the check indicator.
5. Keyboard on one dropdown: open with Enter, arrow down, typeahead a letter, Enter to select, Escape to close.
6. Narrow viewport (<760px): a dropdown opened from the Bible panel overlay renders above it (z-index) and stays on-screen.

- [ ] **Step 2: Confirm no regressions**

Run (from `apps/web/`): `pnpm exec tsc --noEmit && pnpm test`
Expected: clean typecheck; all suites PASS.

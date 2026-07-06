# Custom Dropdown Menus — Design

**Date:** 2026-07-06
**Status:** Approved

## Summary

Replace every native `<select>` popup in the app with a custom-styled
dropdown so open menus match the ink/parchment/gold aesthetic instead of
the OS default. One shared component, built on Base UI's `Select`
primitive (the same library the ui package's `DropdownMenu` already
uses), replaces all five call sites.

## Current call sites

All native selects follow the same chip pattern (bordered span, mono
uppercase text, `ChevronDown` caret):

| File | Selects |
| --- | --- |
| `apps/web/src/components/chat/framework-picker.tsx` | 1 (Tradition, with placeholder) |
| `apps/web/src/components/chat/setup-picker.tsx` | `SelectChip` used 5 ways (opposing, add-tradition, document, collection, purpose) |
| `apps/web/src/components/bible/bible-panel.tsx` | 3 (book, chapter, translation — always set, no placeholder) |

## Component

New `apps/web/src/components/chip-select.tsx` +
`chip-select.module.css`.

- Built on `@base-ui/react/select` (`Select.Root`, `Trigger`, `Value`,
  `Portal`, `Positioner`, `Popup`, `Item`, `ItemText`, `ItemIndicator`).
- Renders the entire chip itself as the trigger — border, current
  label, caret — so consumers stop wrapping selects in chip spans.
- API:
  - `value: string` — current option id, `""` for unset
  - `onChange(id: string): void`
  - `ariaLabel: string`
  - `options: { id: string; label: string }[]`
  - `placeholder?: string` — label shown when `value === ""`
  - `allowEmpty?: boolean` — when true, the placeholder row is a
    selectable option that clears the value (collection picker)
  - `className?: string` — appended to the chip for sizing (e.g. the
    Bible book select's `flex: 1`)
- Trigger states match today: gold text when set, `--parchment-dim`
  when showing the placeholder; hairline border warming to gold on
  hover/focus-within.
- `@base-ui/react@^1.0.0` added to `apps/web` dependencies (already in
  the workspace via `@theologia/ui`, same version).

## Popup styling

- Ink surface (`#120e08`), 1px hairline gold border, 2px radius,
  subtle shadow.
- Items: `--font-geist-mono`, small caps like the trigger, parchment
  text; highlighted item gets gold text on a faint gold wash; selected
  item shows a small check indicator.
- Long lists scroll: `max-height: min(20rem, var(--available-height))`
  (66 books; Psalms has 150 chapters).
- **Portal caveat:** the popup portals to `document.body`, outside the
  chat `.root` where the palette custom properties are defined. The
  popup class re-declares the needed tokens locally
  (`--gold`, `--parchment`, `--parchment-dim`, `--hairline`,
  `--ink-deep`).

## Consumer changes

- `framework-picker.tsx`: becomes a thin wrapper over `ChipSelect`
  (keeps its `FRAMEWORKS` mapping and placeholder "Tradition…").
- `setup-picker.tsx`: `SelectChip` is replaced by direct `ChipSelect`
  usage; the multi-tradition "Add tradition…" chip keeps its
  reset-to-placeholder behavior (`value=""` after each pick). The
  `versus` label and `selected` removal buttons are untouched.
- `bible-panel.tsx`: the three header selects swap to `ChipSelect`;
  book keeps `flex: 1` via `className`. Chapter ids are the stringified
  numbers `"1"`…`"n"`.
- Dead CSS removed: chip/select/caret rules in
  `framework-picker.module.css`, `setup-picker.module.css`, and
  `bible-panel.module.css` (each keeps its unrelated rules).

## Behavior preserved

- Same values flow to the same `onChange` handlers — no state or
  Convex changes.
- Disabled placeholder rows (non-`allowEmpty`) are not selectable.
- Keyboard: arrow navigation, typeahead, Enter/Escape — provided by
  Base UI.

## Testing

- No new unit tests — the component is presentational and vitest runs
  in a node environment without a DOM.
- Verification is runtime: Playwright against the dev server — open
  each dropdown (composer pickers + Bible panel), confirm the custom
  popup renders (not the OS menu), select options, scroll the book
  list, keyboard-navigate one menu.
- Existing lib tests must stay green.

## Out of scope

- `UserMenu` (already a custom Base UI `DropdownMenu`).
- Native pickers on touch devices (custom popup everywhere,
  intentionally).
- Multi-select or search/filter inside dropdowns.

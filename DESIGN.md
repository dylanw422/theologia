# Theologia — Design System

The visual language of Theologia is **the critical edition meets the Renaissance fresco**: the gravity of a scholarly apparatus (margin citations, monospace annotations, hairline rules) set against darkened Old Master paintings lit as if by candlelight. Everything should feel considered, historical, and serious — never a generic SaaS template.

Guiding principles:

- **Reverence over flash.** Gold is an accent for the sacred, not a highlighter. Motion is slow and atmospheric.
- **The page is a manuscript.** Serif display for the voice, monospace for the apparatus, sans for the body.
- **Light emerges from darkness.** Backgrounds are deep near-black; content glows out of a vignette.

---

## Color

Declared as CSS custom properties on each surface root (e.g. `.hero`, `.root` in `auth-layout.module.css`). Redeclare locally rather than relying on a global stylesheet.

| Token | Value | Role |
|---|---|---|
| `--ink` | `#14100a` | Warm near-black — base ink |
| `--ink-deep` | `#0b0805` | Deepest background; page floor |
| `--parchment` | `#f1e8d6` | Primary text on dark |
| `--parchment-dim` | `#b9a886` | Body copy, secondary text |
| `--stone` | `#8a7d68` | Muted labels, placeholders |
| `--gold` | `#c9a24e` | Primary accent, CTAs, active state |
| `--gold-bright` | `#e6c984` | Hover/emphasis, italic display words |
| `--hairline` | `rgba(201, 162, 78, 0.26)` | Borders, rules, dividers |
| `--error` | `#c0392b` | Form validation errors |

**Overlay ink** (for gradients/tints over imagery) is `rgba(11, 8, 5, α)` — the RGB of `--ink-deep`.

---

## Typography

Three typefaces, loaded via `next/font/google` and exposed as CSS variables on `<body>`.

| Variable | Family | Role |
|---|---|---|
| `--font-fraunces` | **Fraunces** (serif, optical sizing) | Display: headlines, wordmark, prices, card titles |
| `--font-geist-mono` | **Geist Mono** | The apparatus: eyebrows, nav, labels, citations, metadata |
| `--font-inter` | **Inter** | Body / lede copy |

### Scale & usage

- **Headline** — Fraunces, weight `370`, `clamp(2.55rem, 6.6vw, 5.5rem)`, `line-height: 0.99`, `letter-spacing: -0.02em`. Emphasis words use `<em>` → italic, weight `400`, colored `--gold-bright`.
- **Eyebrow** — Geist Mono, `0.72rem`, `letter-spacing: 0.28em`, uppercase, `--gold`; preceded by a `2.2rem` gold hairline `::before`.
- **Lede** — Inter, `clamp(1rem, 1.35vw, 1.16rem)`, `line-height: 1.6`, `--parchment-dim`, with a soft dark `text-shadow` for legibility over imagery.
- **Wordmark** — Fraunces, weight `500`, `1.4rem`, `letter-spacing: 0.01em`.
- **Labels / nav / metadata** — Geist Mono, `0.63–0.72rem`, `letter-spacing: 0.1–0.18em`, uppercase.

---

## The Fresco Background System

The signature surface. A darkened Old Master painting behind a vignette, unified with film grain.

Layer stack (low → high `z-index`):

1. **`.fresco`** (`z-index: 0`) — full-bleed image, `filter: saturate(1.14) contrast(1.07) brightness(0.5)`, `transform: scale(1.05)`. Slow `drift` animation (46s, ease-in-out, infinite alternate) behind a `prefers-reduced-motion` guard.
2. **`.overlay`** (`z-index: 1`, `pointer-events: none`) — layered gradients: a directional `95deg` darkening (so text-side reads while the far side glows), a top fade, a bottom fade into `--ink-deep`, and a radial vignette centered slightly high.
3. **`.grain`** (`z-index: 1`) — inline SVG `feTurbulence` noise, `opacity: 0.06`, `mix-blend-mode: overlay`.
4. **`.shell` / content** (`z-index: 3`) — everything interactive.

Images in use: `/school-of-athens.jpg` (homepage), `/creation-of-adam.jpg` (auth pages). Both public domain.

The parent must set `position: relative; isolation: isolate; overflow: hidden;`.

---

## Frosted Glass (blur-behind cards & inputs)

Cards and inputs blur the fresco behind them. Because the page background is already near-black, real `backdrop-filter` shows almost nothing — so we **embed the image in the element and blur it there** via pseudo-elements.

Pattern:

```css
.card {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  border: 1px solid rgba(201, 162, 78, 0.28);
  border-radius: 2px;
}
.card::before {          /* blurred image */
  content: '';
  position: absolute;
  inset: -40px;          /* bleed past edges so blur has no dead border */
  background: url("/creation-of-adam.jpg") center 35% / cover no-repeat;
  filter: blur(20px) brightness(0.46) saturate(1.15) contrast(1.05);
  z-index: -2;
}
.card::after {           /* dark tint for legibility */
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(11, 8, 5, 0.48);
  z-index: -1;
}
```

Conventions:
- **Blur radius:** ~`18–20px` (reduced from the initial 30px — enough to soften without smearing texture into mud).
- **Bleed:** `inset: -30px` to `-40px` so the blur never reveals a hard edge.
- **Tint opacity:** `0.44–0.52` — cards heavier, inputs lighter.
- For **inputs**, wrap the `<input>` in a `.wrapper` (inputs can't host pseudo-elements). Put the border + `:focus-within` on the wrapper; make the input `background: transparent; border: none;` and `flex: 1` so it fills the wrapper height.

---

## Controls

### Primary button (`.btnPrimary`)
Solid `--gold` fill, ink text (`#1a1206`), weight `600`, `border-radius: 2px`. Hover: `--gold-bright`, `translateY(-1px)`, and a warm drop shadow `0 14px 34px -14px rgba(201,162,78,0.6)`. A trailing `→` `.arrow` slides `3px` on hover. Success/disabled state (`.btnPrimarySuccess`) goes transparent with a gold outline.

### Ghost button (`.btnGhost`)
Geist Mono uppercase label, hairline border, transparent fill. Hover raises the border to `--gold` and adds a faint gold wash.

### Inputs
Geist Mono, `--parchment` text, `--stone` placeholder, hairline border → gold on focus. Height should match adjacent buttons (align via wrapper `display: flex`).

---

## Motion

- **Entrance:** `.reveal` rises `18px` + fades over `0.9s cubic-bezier(0.2, 0.7, 0.2, 1)`, staggered by delay utilities `.d1`–`.d5` (`0.05s`→`0.54s`). On section swaps, remount the content with a React `key` to replay the choreography.
- **Ambient:** the fresco `drift` (46s).
- **Micro:** `0.22–0.25s ease` on color/border/transform for hovers.
- **Always** wrap decorative motion in `@media (prefers-reduced-motion)` guards.

---

## Layout & Spacing

- Fluid spacing via `clamp()` throughout; e.g. section padding `clamp(1.25rem, 4vw, 3.5rem)`.
- Content max-width `1180px`, centered.
- The hero uses a two-column grid (`170px` margin apparatus + content) that collapses to one column under `760px`, reordering the citation apparatus below the text.
- Borders and dividers are always `1px` `--hairline`. Radius is a restrained `2px` everywhere — this is print, not a rounded app.

---

## Iconography

App icon: a serifed **Chi-Rho** (Wikimedia source path, recolored to parchment `#e8d9b8`) or the **T** wordmark, centered on the dark fresco-and-candlelight template — radial `#1e1709 → #040201` gradient, warm gold glow, film grain, `115px` corner radius, faint gold inner border. Saved as `icon-512.png` and `icon-100.png`.

---

## Do / Don't

- **Do** keep gold rare and intentional. **Don't** use it for large fills beyond CTAs.
- **Do** let content emerge from a dark vignette. **Don't** place text on the bright center of a fresco without darkening.
- **Do** use monospace for anything that reads as apparatus/metadata. **Don't** set body copy in monospace.
- **Do** guard every animation with reduced-motion. **Don't** add fast or bouncy motion — the register is slow and reverent.

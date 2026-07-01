# Dust Carousel — Design Spec

**Date:** 2026-07-01  
**Status:** Approved

---

## Overview

Convert the home page's static Hero into a full-viewport carousel of four marketing panels (Home, Frameworks, Library, Pricing). When a user clicks a nav link, the current panel's text characters scatter into dust and blow away — left when navigating forward, right when navigating backward. The new panel's characters assemble from the opposite direction. The fresco background and nav bar are persistent and do not animate.

---

## Architecture

### Component structure

```
apps/web/src/components/
  hero.tsx                      ← shell: background layers + nav + <Carousel>
  hero.module.css               ← existing styles + carousel/slide additions
  carousel/
    carousel.tsx                ← state: currentSlide, direction; AnimatePresence wrapper
    split-text.tsx              ← splits text into per-character <motion.span>s
    home-slide.tsx              ← existing hero main content, ported as a slide
    frameworks-slide.tsx
    library-slide.tsx
    pricing-slide.tsx
```

### Carousel slides (ordered)

| Index | Label | Path |
|-------|-------|------|
| 0 | Home | `/` |
| 1 | Frameworks | `/frameworks` |
| 2 | Library | `/library` |
| 3 | Pricing | `/pricing` |

### Routing

Nav links become carousel controls rather than Next.js `<Link>` components. On click:

1. Compute direction: `targetIndex > currentIndex` → blow left; otherwise blow right
2. Trigger exit animation on current slide characters
3. After exit completes, swap slide and run entry animation
4. Call `router.replace(href, { scroll: false })` to keep URL in sync (bookmarkable, back-button aware)

`Sign in` remains a real `<Link href="/dashboard">` — it is not part of the carousel.

On initial page load, read `pathname` to set the correct starting slide index with no animation.

---

## Animation Design

### Dependency

Add `framer-motion` to `apps/web`.

### SplitText component

`split-text.tsx` accepts a `children` string and a Framer Motion `variants` prop. It renders each character as a `<motion.span style={{ display: 'inline-block' }}>`. Spaces render as `&nbsp;` to preserve word spacing. Punctuation is included as individual characters.

### Exit animation (blow away)

Triggered by `AnimatePresence` exit. Per character:

| Property | Value |
|----------|-------|
| `translateX` | Random ±80–220px, biased in blow direction (forward = negative, backward = positive) |
| `translateY` | Random ±40–80px |
| `rotate` | Random ±45–120° |
| `scale` | `0.3` |
| `opacity` | `0` |
| `filter` | `blur(4px)` |
| Duration | `400ms`, `easeIn` |
| Stagger | `0–300ms` total, random per character |

### Entry animation (assemble)

Characters start from the opposite edge (off-screen), blur, opacity 0 → coalesce to natural position:

| Property | Start | End |
|----------|-------|-----|
| `translateX` | Opposite of exit direction, ±60–160px | `0` |
| `translateY` | ±20–60px | `0` |
| `rotate` | ±30–80° | `0` |
| `scale` | `0.4` | `1` |
| `opacity` | `0` | `1` |
| `filter` | `blur(4px)` | `blur(0)` |
| Duration | `500ms`, `easeOut` |
| Stagger | `0–400ms` total |

### Elements that animate

- Eyebrow text
- Headline (each word wrapped, each character split)
- Lede paragraph
- CTA button labels
- Citations apparatus text

### Elements that do not animate

- Fresco background (continues its slow `drift` keyframe)
- Overlay and grain layers
- Nav bar (wordmark + nav links)
- Frameworks strip at the bottom

### Reduced motion

When `prefers-reduced-motion: reduce` is set, replace the scatter animation with a simple cross-fade: `opacity 0 → 1`, `duration 300ms`, no translate/rotate/blur.

---

## Layout: 100vh Constraint

| Selector | Change |
|----------|--------|
| `.hero` | `min-height: 100svh` → `height: 100dvh` |
| `.shell` | `min-height: 100svh` → `height: 100dvh` |
| `.main` | Add `overflow: hidden` |

`100dvh` accounts for collapsing browser chrome on mobile. The flex column layout (nav → main → frameworks strip) already fills the height correctly — no additional JS needed.

---

## Panel Content

All panels share the same visual structure: citations apparatus (left column) + text column (eyebrow → headline → lede → CTAs).

### Home

Existing content, ported as `home-slide.tsx`.

### Frameworks

- **Citations:** `Acts 17:11 · the Bereans` / `WCF · 1647` / `Via Antiqua`
- **Eyebrow:** Twelve traditions · one text
- **Headline:** Every tradition reads the same Bible differently.
- **Lede:** Reformed, Lutheran, Wesleyan, Roman Catholic — each tradition carries centuries of exegesis, controversy, and refinement. Theologia surfaces the lens your tradition brings to every question, so you understand not just what it teaches, but why.
- **Primary CTA:** Choose your tradition →
- **Ghost CTA:** See all frameworks

### Library

- **Citations:** `Nicaea · 325` / `Chalcedon · 451` / `Augsburg · 1530`
- **Eyebrow:** Primary sources · councils · creeds
- **Headline:** Two thousand years of the church's best thinking.
- **Lede:** Church fathers, ecumenical councils, confessions of faith, and Reformed scholastics — all indexed, cross-referenced, and surfaced inline as you study. Every answer is grounded in the tradition's own sources, not summaries.
- **Primary CTA:** Browse the library →
- **Ghost CTA:** View sources

### Pricing

- **Citations:** `Lk 10:7 · worthy of wages` / `Pro 4:7 · get wisdom` / `Free tier`
- **Eyebrow:** Free · Scholar · Institution
- **Headline:** Serious theology shouldn't cost a fortune.
- **Lede:** Start studying free — no credit card, no time limit. Upgrade to Scholar for unlimited research sessions, source citations, and framework comparisons. Institution plans for seminaries, churches, and cohorts.
- **Primary CTA:** Start studying — free →
- **Ghost CTA:** See all plans

---

## Out of Scope

- Actual Frameworks, Library, and Pricing page functionality (those are separate features)
- Mobile carousel swipe gestures
- Keyboard arrow-key navigation (can be added later)
- The `header.tsx` component (separate from the Hero nav, used on other pages — not modified)

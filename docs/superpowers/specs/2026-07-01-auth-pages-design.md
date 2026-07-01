# Auth Pages Design

**Date:** 2026-07-01
**Status:** Approved

## Overview

Dedicated `/sign-in` and `/sign-up` pages for Theologia. Full-screen immersive layout using Michelangelo's *Creation of Adam* as background, styled consistently with the hero section's dark fresco aesthetic. The forms use existing `@tanstack/react-form` + `better-auth` logic, restyled to match the custom CSS Modules design system rather than the default shadcn/ui light theme.

## Routes

| Route | File | Purpose |
|---|---|---|
| `/sign-in` | `apps/web/src/app/sign-in/page.tsx` | Sign-in page |
| `/sign-up` | `apps/web/src/app/sign-up/page.tsx` | Sign-up page |

## Files Created / Modified

| File | Action | Notes |
|---|---|---|
| `apps/web/src/components/auth-layout.tsx` | Create | Shared background + card + wordmark wrapper |
| `apps/web/src/components/auth-layout.module.css` | Create | Styles for auth pages |
| `apps/web/src/app/sign-in/page.tsx` | Create | Thin page that renders `AuthLayout` + `SignInForm` |
| `apps/web/src/app/sign-up/page.tsx` | Create | Thin page that renders `AuthLayout` + `SignUpForm` |
| `apps/web/src/components/sign-in-form.tsx` | Modify | Replace shadcn `Button`/`Input`/`Label` with CSS Module equivalents |
| `apps/web/src/components/sign-up-form.tsx` | Modify | Same as above |
| `apps/web/src/components/hero.tsx` | Modify | Update nav "Sign in" link from `/dashboard` → `/sign-in` |
| `apps/web/public/creation-of-adam.jpg` | Already added | Background image |

## Visual Design

### Background
- Image: `/creation-of-adam.jpg`
- Crop position: `center 40%` — keeps the finger gap and God's outstretched hand in frame
- Filter: `saturate(1.1) contrast(1.08) brightness(0.38)`
- Slow drift animation (same keyframes as hero `.fresco`)

### Overlay / Vignette
- Same multi-layer gradient as hero: strong left→right darkening + top/bottom fade + radial vignette
- Center remains lighter so the painting breathes through the card

### Film Grain
- Same SVG `feTurbulence` grain as hero at `opacity: 0.06`

### Card
- `background: rgba(11,8,5,0.72)`
- `backdrop-filter: blur(12px)`
- `border: 1px solid rgba(201,162,78,0.28)` (same as pricing cards)
- `border-radius: 2px`
- `padding: 2.4rem 2.8rem`
- Max width: `420px`, centered horizontally and vertically

### Wordmark
- Top-left of page, same `.wordmark` typography as hero (Fraunces, 1.4rem)
- Wrapped in `<Link href="/">` to return to homepage

### Form Fields
- Dark glass inputs matching hero `.emailInput`: `rgba(11,8,5,0.55)` background, `backdrop-filter: blur(6px)`, 1px gold hairline border, gold focus ring, Geist Mono font
- Labels: Geist Mono, 0.7rem, letter-spacing, parchment-dim color
- Error text: `#c0392b` (muted red, readable on dark)

### Buttons
- Submit: gold `.btnPrimary` style (same as hero)
- Switch link (e.g. "Need an account? Sign up"): Geist Mono, parchment-dim, no button chrome

## Form Logic (Unchanged)

- `SignInForm`: `authClient.signIn.email()` → on success redirect to `/dashboard`
- `SignUpForm`: `authClient.signUp.email()` → on success redirect to `/dashboard`
- Validation: `@tanstack/react-form` + zod (already implemented)
- Errors: `sonner` toast (already implemented)
- The `onSwitchToSignUp` / `onSwitchToSignIn` props on the form components become `<Link>` navigation instead of a state callback — the pages are separate routes, so switching is just navigation

## Design Tokens (from hero.module.css)

```
--ink:        #14100a
--ink-deep:   #0b0805
--parchment:  #f1e8d6
--parchment-dim: #b9a886
--stone:      #8a7d68
--gold:       #c9a24e
--gold-bright: #e6c984
--hairline:   rgba(201,162,78,0.26)
```

These are redeclared on the auth layout root element so no global CSS dependency is introduced.

## Navigation Update

`hero.tsx` nav: change `<Link href="/dashboard" className={styles.navSignIn}>Sign in</Link>` to `<Link href="/sign-in" ...>`.

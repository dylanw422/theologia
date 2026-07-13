# Profile Opt-In Chat Touchpoint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface the theological-profile opt-in as a quiet, dismissible card in the chat pane for paid users who have never made a profile decision, closing THEOLOGICAL_PROFILE.md's "explicit opt-in at first eligible conversation" requirement.

**Architecture:** One new public Convex query (`hasProfileDecision`: does a `profileSettings` row exist?) plus one new web component (`ProfileOptInCard`) rendered from `chat-app.tsx`, gated client-side on `getUsage().planId` (same pattern as `ChatUpgradeBanner`). Both card actions record a real decision through the existing `setOptIn` mutation — "Not now" writes `optedIn: false`, so the card never nags again.

**Tech Stack:** Convex (query, convex-test), Next.js + CSS modules, sonner toasts, Bun monorepo.

**Spec:** `docs/superpowers/specs/2026-07-12-profile-optin-chat-touchpoint-design.md`

## Global Constraints

- The card shows ONLY when `usage.planId !== "free"` AND `hasProfileDecision === false`. Every doubt path (unauthenticated, queries still loading) hides it.
- `hasProfileDecision` contains NO plan logic (polar isn't loadable under convex-test); the plan gate lives client-side.
- "Not now" is a recorded decision (`setOptIn({ optedIn: false })`), not a session dismiss.
- Never the word "contradiction" (any form) in copy. Manuscript register.
- Mutation failures surface an error toast; the card stays interactive.
- Commit directly to `master` (repo convention), `feat(backend):` / `feat(web):` message style, commits end with the Claude Fable co-author line.
- Tests: convex-test files carry `// @vitest-environment edge-runtime`; run from `packages/backend` / `apps/web` with `bunx vitest run <path>`. Typecheck with direct `tsc --noEmit` per package (root `check-types` only covers @theologia/ui).

---

### Task 1: `hasProfileDecision` query

**Files:**
- Modify: `packages/backend/convex/profile.ts` (add one public query after `setPaused`)
- Test: `packages/backend/convex/profile.test.ts` (append a describe block; extend imports)

**Interfaces:**
- Consumes: existing `settingsForUser(ctx, userId)` helper and `authComponent.safeGetAuthUser` (both already in profile.ts).
- Produces: `api.profile.hasProfileDecision` — public query, no args, returns `boolean`. `true` = decided OR unauthenticated (hide the card); `false` = authed user with no `profileSettings` row (show it, subject to the client-side plan gate). Task 2 relies on exactly this contract.

- [ ] **Step 1: Write the failing test**

Append to `packages/backend/convex/profile.test.ts`:

```typescript
describe("hasProfileDecision", () => {
  test("true when unauthenticated — the card hides on doubt", async () => {
    const t = convexTest(schema, modules);
    expect(await t.query(api.profile.hasProfileDecision, {})).toBe(true);
  });

  test("a settings row from either decision counts as decided", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      expect(await settingsForUser(ctx as never, "u1")).toBeNull();
      // Declining is a decision too — the row, not its value, is the signal.
      await upsertSettings(ctx as never, "u1", { optedIn: false });
      expect(await settingsForUser(ctx as never, "u1")).not.toBeNull();
    });
  });
});
```

Extend the `./_generated/api` import at the top of the file to include `api`:

```typescript
import { api, internal } from "./_generated/api";
```

Note: if the unauthenticated `t.query` test fails because `authComponent` requires its better-auth component under convex-test (error mentioning a missing component rather than a failing assertion), delete that one test, keep the helper-level test, and record the substitution in your report — do not fight the auth component.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/dylanwest/Coding/theologia/packages/backend && bunx vitest run convex/profile.test.ts`
Expected: FAIL — `hasProfileDecision` does not exist on `api.profile`.

- [ ] **Step 3: Implement**

In `packages/backend/convex/profile.ts`, add after the `setPaused` mutation:

```typescript
/**
 * Whether the user has ever made a profile decision — opting in OR declining
 * both create a profileSettings row, so row-existence is the signal. The
 * in-chat opt-in card shows only on an affirmative false, so unauthenticated
 * returns true (hide on doubt). Plan gating lives client-side on getUsage —
 * no polar logic here (it can't run under convex-test).
 */
export const hasProfileDecision = query({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return true;
    return (await settingsForUser(ctx, user._id)) !== null;
  },
});
```

- [ ] **Step 4: Run tests to verify they pass, then typecheck**

Run: `cd /Users/dylanwest/Coding/theologia/packages/backend && bunx vitest run convex/profile.test.ts && bunx tsc --noEmit -p convex/tsconfig.json`
Expected: all tests PASS, typecheck clean.

- [ ] **Step 5: Commit**

```bash
cd /Users/dylanwest/Coding/theologia
git add packages/backend/convex/profile.ts packages/backend/convex/profile.test.ts
git commit -m "feat(backend): hasProfileDecision query for the in-chat opt-in card

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: `ProfileOptInCard` component + chat wiring

**Files:**
- Create: `apps/web/src/components/chat/profile-optin-card.tsx`
- Create: `apps/web/src/components/chat/profile-optin-card.module.css`
- Modify: `apps/web/src/components/chat/chat-app.tsx` (one import + one render line)

**Interfaces:**
- Consumes: `api.profile.hasProfileDecision` (Task 1: no args → boolean, `false` = show), `api.usage.getUsage` (existing: `usage?.planId`), `api.profile.setOptIn` (existing mutation `{ optedIn: boolean }`).
- Produces: default-export React component `ProfileOptInCard` with no props.

- [ ] **Step 1: Create the component**

Create `apps/web/src/components/chat/profile-optin-card.tsx`:

```tsx
"use client";

import Link from "next/link";

import { api } from "@theologia/backend/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";

import styles from "./profile-optin-card.module.css";

/**
 * The "explicit opt-in at first eligible conversation" touchpoint
 * (docs/THEOLOGICAL_PROFILE.md §User control). Shows only for paid users who
 * have never made a profile decision; either action records one through
 * setOptIn, so the card never reappears. /profile remains the place to
 * change your mind.
 */
export default function ProfileOptInCard() {
  const usage = useQuery(api.usage.getUsage);
  const decided = useQuery(api.profile.hasProfileDecision);
  const setOptIn = useMutation(api.profile.setOptIn);

  // Hide on every doubt path: loading, signed out, free plan, or decided.
  if (!usage || usage.planId === "free" || decided !== false) return null;

  async function decide(optedIn: boolean) {
    try {
      await setOptIn({ optedIn });
      if (optedIn) {
        toast.success("Your profile has begun — see Your Theology.");
      }
    } catch (error) {
      console.error("profile opt-in decision failed", error);
      toast.error("Could not save your choice. Please try again.");
    }
  }

  return (
    <aside className={styles.card} aria-label="Theological profile opt-in">
      <h2 className={styles.title}>Keep a record of what you believe?</h2>
      <p className={styles.copy}>
        With your permission, Theologia records the positions you affirm in
        your own words — one sentence each, linked to the study where you took
        them — and your answers draw on them, so each study builds on the
        last. Everything is editable, exportable, and deletable; never shared,
        never used in marketing, never used to train models.{" "}
        <Link href="/profile" className={styles.learnMore}>
          Learn more
        </Link>
      </p>
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.primary}
          onClick={() => decide(true)}
        >
          Begin my profile
        </button>
        <button
          type="button"
          className={styles.quiet}
          onClick={() => decide(false)}
        >
          Not now
        </button>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Create the stylesheet**

Create `apps/web/src/components/chat/profile-optin-card.module.css`. Before writing it, verify the custom properties used below exist in the chat styles (`grep -h "\-\-parchment\|\-\-stone\|\-\-hairline\|\-\-gold\|\-\-font-fraunces\|\-\-font-geist-mono" apps/web/src/components/chat/*.module.css apps/web/src/app/*.css | head`); if a token is missing there but present in `profile-page.module.css`'s usage, substitute the nearest token that greps clean and note it in your report.

```css
.card {
  position: relative;
  flex-shrink: 0;
  margin: 12px 16px 0;
  padding: 14px 18px;
  background: rgba(11, 8, 5, 0.72);
  border: 1px solid var(--hairline);
  border-radius: 2px;
}

.title {
  font-family: var(--font-fraunces), serif;
  font-optical-sizing: auto;
  font-weight: 400;
  font-size: 1.05rem;
  color: var(--parchment);
  margin: 0 0 0.35rem;
}

.copy {
  font-size: 12.5px;
  line-height: 1.55;
  color: var(--parchment-dim);
  margin: 0 0 0.7rem;
}

.learnMore {
  color: var(--gold);
  text-decoration: underline;
}
.learnMore:hover {
  color: var(--gold-bright);
}

.actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.primary,
.quiet {
  font-family: var(--font-geist-mono), monospace;
  font-size: 0.68rem;
  letter-spacing: 0.08em;
  cursor: pointer;
  border-radius: 2px;
  padding: 0.35rem 0.7rem;
}

.primary {
  color: var(--gold);
  background: none;
  border: 1px solid var(--gold);
}
.primary:hover {
  color: var(--gold-bright);
  border-color: var(--gold-bright);
}

.quiet {
  color: var(--stone);
  background: none;
  border: 1px solid transparent;
}
.quiet:hover {
  color: var(--parchment-dim);
  border-color: var(--hairline);
}
```

- [ ] **Step 3: Wire into `chat-app.tsx`**

In `apps/web/src/components/chat/chat-app.tsx`:

Add the import with the other `./` component imports (sorted position, after `LiveThread`'s import line is fine per the file's convention):

```typescript
import ProfileOptInCard from "./profile-optin-card";
```

Render it as the first child of the content column — change:

```tsx
          <div className={styles.content}>
            {active ? (
```

to:

```tsx
          <div className={styles.content}>
            <ProfileOptInCard />
            {active ? (
```

- [ ] **Step 4: Typecheck and run the web suite**

Run: `cd /Users/dylanwest/Coding/theologia/apps/web && bunx tsc --noEmit && bunx vitest run`
Expected: typecheck clean; all web tests PASS (no new tests — the component has no extractable pure logic, matching the `ChatUpgradeBanner` precedent).

- [ ] **Step 5: Commit**

```bash
cd /Users/dylanwest/Coding/theologia
git add apps/web/src/components/chat/profile-optin-card.tsx apps/web/src/components/chat/profile-optin-card.module.css apps/web/src/components/chat/chat-app.tsx
git commit -m "feat(web): in-chat profile opt-in card — first eligible conversation touchpoint

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Verification

- [ ] **Step 1: Full suites + typechecks**

```bash
cd /Users/dylanwest/Coding/theologia/packages/backend && bunx vitest run && bunx tsc --noEmit -p convex/tsconfig.json
cd /Users/dylanwest/Coding/theologia/apps/web && bunx vitest run && bunx tsc --noEmit
```

Expected: all green.

- [ ] **Step 2: Manual smoke (Dylan, in-app, with the Phase 3 checklist)**

- Paid user, never decided: card appears in chat (both empty and active states); "Not now" removes it permanently across reloads; `/profile` still offers opt-in.
- Paid user after "Begin my profile": toast appears, card gone, extraction eligibility active (send a message, confirm no errors).
- Free user and signed-out: no card.

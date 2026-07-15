# Home Tradition at Signup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a required tradition dropdown to signup, save it as the user's default, pre-fill new conversations' setup from it, and let the user change the default later on `/profile`.

**Architecture:** A new per-user Convex table (`userPreferences`) stores `defaultFramework`. A thin backend module exposes an authed `query`/`mutation` pair over it. The web app calls the mutation once at signup and reuses the existing `FrameworkPicker` chip-select component (already used in the chat composer) in two new places: the signup form and a new control on `/profile`. `ChatEmpty` pre-fills a new conversation's `framework` field from the query, for the setup kinds that use it.

**Tech Stack:** Convex (backend, convex-test/vitest for tests), Next.js + `@tanstack/react-form` + Zod (signup form), `convex/react` (`useQuery`/`useMutation`/`useConvexAuth`).

## Global Constraints

- Top-level tradition only — no sub-tradition capture at signup (`Framework.id`, not `SubTradition.id`).
- The signup dropdown is required; the form cannot submit without a selection.
- Per-conversation override via `SetupPicker` is unchanged — it edits only that conversation's local `ConversationSetup`, never the stored default.
- `ChatEmpty.handleModeChange`'s setup-reset-on-mode-switch behavior is unchanged (out of scope — separate bug, tracked in `docs/IMPROVE_UX.md` Tier 1 #1).
- All Convex functions require argument validators (`v.*`), per `packages/backend/convex/_generated/ai/guidelines.md`.
- Reuse `FrameworkPicker` (`apps/web/src/components/chat/framework-picker.tsx`) wherever a tradition needs picking — do not introduce a native `<select>` or a second chip-select wrapper; the app has no native `<select>` anywhere today.

---

### Task 1: Backend — `userPreferences` table and module

**Files:**
- Modify: `packages/backend/convex/schema.ts`
- Create: `packages/backend/convex/userPreferences.ts`
- Test: `packages/backend/convex/userPreferences.test.ts`

**Interfaces:**
- Produces: `preferencesForUser(ctx, userId): Promise<Doc<"userPreferences"> | null>`, `upsertDefaultFramework(ctx, userId, framework): Promise<void>` (throws `Error("Unknown tradition: <id>")` for an id not in `FRAMEWORKS`), `api.userPreferences.getDefaultFramework` (query, no args) → `string | null`, `api.userPreferences.setDefaultFramework` (mutation, `{ framework: string }`) → `null`.

- [ ] **Step 1: Write the failing test file**

Create `packages/backend/convex/userPreferences.test.ts`:

```ts
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";

import { api } from "./_generated/api";
import schema from "./schema";
import { preferencesForUser, upsertDefaultFramework } from "./userPreferences";

const modules = import.meta.glob("./**/*.ts");

describe("userPreferences helpers", () => {
  test("upsertDefaultFramework creates then updates a single row", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      expect(await preferencesForUser(ctx as never, "u1")).toBeNull();

      await upsertDefaultFramework(ctx as never, "u1", "reformed");
      let prefs = await preferencesForUser(ctx as never, "u1");
      expect(prefs?.defaultFramework).toBe("reformed");

      await upsertDefaultFramework(ctx as never, "u1", "baptist");
      prefs = await preferencesForUser(ctx as never, "u1");
      expect(prefs?.defaultFramework).toBe("baptist");

      const rows = await ctx.db.query("userPreferences").collect();
      expect(rows).toHaveLength(1);
    });
  });

  test("upsertDefaultFramework rejects an unknown tradition id", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await expect(
        upsertDefaultFramework(ctx as never, "u1", "not-a-tradition"),
      ).rejects.toThrow("Unknown tradition");
    });
  });
});

describe("getDefaultFramework", () => {
  test("null when unauthenticated", async () => {
    const t = convexTest(schema, modules);
    expect(
      await t.query(api.userPreferences.getDefaultFramework, {}),
    ).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @theologia/backend test userPreferences.test.ts`
Expected: FAIL — `userPreferences.ts` does not exist (module not found), and `schema.ts` has no `userPreferences` table.

- [ ] **Step 3: Add the `userPreferences` table to the schema**

In `packages/backend/convex/schema.ts`, add a new table to the `defineSchema({...})` object, after `profileSettings` (around line 91):

```ts
  // Per-user default tradition, set at signup and editable on /profile.
  // Pre-fills new conversations' setup; per-conversation overrides via
  // SetupPicker never write back here.
  userPreferences: defineTable({
    userId: v.string(),
    defaultFramework: v.string(), // Framework.id from lib/studyData.ts FRAMEWORKS
  }).index("by_user", ["userId"]),
```

- [ ] **Step 4: Implement the backend module**

Create `packages/backend/convex/userPreferences.ts`:

```ts
import { v } from "convex/values";

import type { Doc } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { authComponent } from "./auth";
import { getFramework } from "./lib/studyData";

async function requireUser(ctx: QueryCtx | MutationCtx) {
  const user = await authComponent.safeGetAuthUser(ctx);
  if (!user) throw new Error("Not authenticated");
  return user;
}

export async function preferencesForUser(
  ctx: QueryCtx | MutationCtx,
  userId: string,
): Promise<Doc<"userPreferences"> | null> {
  return await ctx.db
    .query("userPreferences")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
}

export async function upsertDefaultFramework(
  ctx: MutationCtx,
  userId: string,
  framework: string,
): Promise<void> {
  if (!getFramework(framework)) {
    throw new Error(`Unknown tradition: ${framework}`);
  }
  const existing = await preferencesForUser(ctx, userId);
  if (existing) {
    await ctx.db.patch(existing._id, { defaultFramework: framework });
  } else {
    await ctx.db.insert("userPreferences", { userId, defaultFramework: framework });
  }
}

export const getDefaultFramework = query({
  args: {},
  returns: v.union(v.string(), v.null()),
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return null;
    const prefs = await preferencesForUser(ctx, user._id);
    return prefs?.defaultFramework ?? null;
  },
});

export const setDefaultFramework = mutation({
  args: { framework: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await upsertDefaultFramework(ctx, user._id, args.framework);
    return null;
  },
});
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter @theologia/backend test userPreferences.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add packages/backend/convex/schema.ts packages/backend/convex/userPreferences.ts packages/backend/convex/userPreferences.test.ts
git commit -m "feat(backend): userPreferences table for default tradition"
```

---

### Task 2: Signup form — required tradition dropdown, saved on success

**Files:**
- Modify: `apps/web/src/components/sign-up-form.tsx`

**Interfaces:**
- Consumes: `FrameworkPicker` (`apps/web/src/components/chat/framework-picker.tsx`) — props `{ framework: string; onFrameworkChange: (id: string) => void }`. `api.userPreferences.setDefaultFramework` from Task 1.
- Produces: nothing new consumed by later tasks (signup is a leaf).

There is no automated test harness for `.tsx` components in this repo (only `lib/*.ts` pure logic gets `.test.ts` files — confirmed by `apps/web/src/components/**/*.test.ts` containing no `.tsx` tests). Verify this task by running the dev server and exercising the form manually (Step 4).

- [ ] **Step 1: Add the tradition field to the form**

In `apps/web/src/components/sign-up-form.tsx`, add the import and rework the form hook and JSX as follows.

Add to the top imports (after the existing `authClient` import):

```tsx
import { api } from "@theologia/backend/convex/_generated/api";
import { useConvexAuth, useMutation } from "convex/react";

import FrameworkPicker from "./chat/framework-picker";
```

Replace the `useForm` block and the state around it:

```tsx
export default function SignUpForm() {
  const router = useRouter();
  const { isAuthenticated } = useConvexAuth();
  const setDefaultFramework = useMutation(api.userPreferences.setDefaultFramework);
  const [pendingFramework, setPendingFramework] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !pendingFramework) return;
    const framework = pendingFramework;
    setPendingFramework(null);
    setDefaultFramework({ framework }).catch(() => {
      toast.warning(
        "Account created, but we couldn't save your tradition — set it on your profile page.",
      );
    });
    router.push("/chat");
    toast.success("Account created");
  }, [isAuthenticated, pendingFramework, setDefaultFramework, router]);

  const form = useForm({
    defaultValues: { name: "", email: "", password: "", tradition: "" },
    onSubmit: async ({ value }) => {
      await authClient.signUp.email(
        { email: value.email, password: value.password, name: value.name },
        {
          onSuccess: () => {
            setPendingFramework(value.tradition);
          },
          onError: (error) => {
            toast.error(error.error.message || error.error.statusText);
          },
        },
      );
    },
    validators: {
      onSubmit: z.object({
        name: z.string().min(2, "Name must be at least 2 characters"),
        email: z.email("Invalid email address"),
        password: z.string().min(8, "Password must be at least 8 characters"),
        tradition: z.string().min(1, "Choose a tradition"),
      }),
    },
  });
```

Add `useEffect` to the React import at the top of the file:

```tsx
import { useEffect, useState } from "react";
```

Add the field's JSX, inserted after the `password` `form.Field` block and before the `form.Subscribe` block:

```tsx
      <form.Field name="tradition">
        {(field) => (
          <div className={styles.field}>
            <label htmlFor={field.name} className={styles.label}>Tradition</label>
            <FrameworkPicker
              framework={field.state.value}
              onFrameworkChange={(id) => field.handleChange(id)}
            />
            {field.state.meta.errors.map((error) => (
              <p key={error?.message} className={styles.error}>{error?.message}</p>
            ))}
          </div>
        )}
      </form.Field>
```

- [ ] **Step 2: Run type-check**

Run: `pnpm check-types`
Expected: passes with no errors in `apps/web` or `packages/backend`.

- [ ] **Step 3: Start the dev servers**

Run: `pnpm dev:server` (in one terminal) and `pnpm dev:web` (in another), or `pnpm dev` for both.

- [ ] **Step 4: Manually verify in the browser**

Navigate to `http://localhost:3001/sign-up`.
- Confirm a "Tradition" field renders below Password, styled as a chip-select (click it — a popup with all `FRAMEWORKS` labels should open).
- Try submitting with no tradition chosen: confirm the button stays disabled (or submission is blocked) and "Choose a tradition" appears.
- Fill in name/email/password, pick a tradition (e.g. "Reformed"), submit.
- Confirm redirect to `/chat` and a success toast.
- Open the Convex dashboard (or query via `npx convex run userPreferences:getDefaultFramework` while impersonating, or just check on `/profile` once Task 4 lands) to confirm a `userPreferences` row was created with the chosen `defaultFramework`. (If Task 4 isn't done yet, skip this row-check and revisit after Task 4.)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/sign-up-form.tsx
git commit -m "feat(web): required tradition dropdown at signup"
```

---

### Task 3: Pre-fill new conversation setup from the default tradition

**Files:**
- Modify: `apps/web/src/components/chat/chat-empty.tsx`

**Interfaces:**
- Consumes: `api.userPreferences.getDefaultFramework` from Task 1. `SetupKind` type from `./lib/modes`.
- Produces: nothing new consumed by later tasks.

- [ ] **Step 1: Add the query and pre-fill effect**

In `apps/web/src/components/chat/chat-empty.tsx`, update the imports at the top:

```tsx
"use client";

import { useEffect, useState } from "react";

import { api } from "@theologia/backend/convex/_generated/api";
import { useQuery } from "convex/react";

import ChatComposer, { type ComposerInsert } from "./chat-composer";
import type { ConversationSetup, ModeId } from "./lib/chat-state";
import { getMode, isSetupValid, type SetupKind } from "./lib/modes";
import ModePicker from "./mode-picker";
import SetupPicker from "./setup-picker";
import styles from "./chat-empty.module.css";

/** Setup kinds whose `framework` field the default tradition can pre-fill.
 *  "multi-tradition" (Comparison) and "document"/"collection" (Catechism/
 *  Library) don't have a single framework field, so they're excluded. */
const FRAMEWORK_SETUP_KINDS: SetupKind[] = [
  "tradition",
  "versus",
  "tradition-purpose",
];
```

Update the component body — add the query and a pre-fill effect right after the existing `useState` calls:

```tsx
  const [mode, setMode] = useState<ModeId>("qa");
  const [setup, setSetup] = useState<ConversationSetup>({});
  const defaultFramework = useQuery(api.userPreferences.getDefaultFramework);

  const modeDef = getMode(mode);
  const canSend = isSetupValid(mode, setup);

  useEffect(() => {
    if (!defaultFramework) return;
    if (!FRAMEWORK_SETUP_KINDS.includes(modeDef.setup)) return;
    if (setup.framework) return;
    setSetup((prev) => ({ ...prev, framework: defaultFramework }));
  }, [defaultFramework, modeDef.setup, setup.framework]);

  function handleModeChange(next: ModeId) {
    setMode(next);
    setSetup({});
  }
```

(Leave `handleSend` and the JSX below unchanged.)

- [ ] **Step 2: Run type-check**

Run: `pnpm check-types`
Expected: passes with no errors.

- [ ] **Step 3: Manually verify in the browser**

With the dev server running and a signed-in user who has a `defaultFramework` set (from Task 2's manual test):
- Go to `/chat`, click "New Study" (or land on the empty state).
- Confirm the Q&A mode's tradition chip shows the saved default already selected (not "Tradition…" placeholder).
- Switch to "Comparison" mode: confirm no traditions are pre-filled (expected — multi-tradition is excluded).
- Switch back to "Q&A": confirm the default tradition chip is filled in again (mode switch resets `setup` to `{}`, and the effect re-fills it).
- Manually change the tradition chip to something else, then send a message. Reload `/chat` and start a new study again: confirm it's back to showing the saved default, not the one-off override from the previous conversation.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/chat/chat-empty.tsx
git commit -m "feat(web): pre-fill new conversation setup from default tradition"
```

---

### Task 4: Edit the default tradition on `/profile`

**Files:**
- Modify: `apps/web/src/components/profile/profile-page.tsx`

**Interfaces:**
- Consumes: `api.userPreferences.getDefaultFramework` / `api.userPreferences.setDefaultFramework` from Task 1, `FrameworkPicker` from `../chat/framework-picker`.
- Produces: nothing new consumed by later tasks.

- [ ] **Step 1: Add the query, mutation, and control**

In `apps/web/src/components/profile/profile-page.tsx`, add to the imports (after the existing `useConvex, useMutation, useQuery` import line):

```tsx
import FrameworkPicker from "../chat/framework-picker";
```

Inside `ProfilePage`, add the query/mutation alongside the existing ones (after `const deleteAll = useMutation(...)`, before `const convex = useConvex();`):

```tsx
  const defaultFramework = useQuery(api.userPreferences.getDefaultFramework);
  const setDefaultFramework = useMutation(api.userPreferences.setDefaultFramework);
```

Add the control to the page header, inside `<header className={styles.header}>`, after the closing `</p>` of the `lede` paragraph (i.e. as the last child of `<header>`, so it renders for every authenticated user regardless of plan/opt-in — the existing `.controls` row further down is gated behind `!isFree && profile.optedIn` and must NOT be used for this):

```tsx
          <div className={styles.pauseControl}>
            <span className={styles.label}>Default tradition</span>
            <FrameworkPicker
              framework={defaultFramework ?? ""}
              onFrameworkChange={(id) => {
                setDefaultFramework({ framework: id }).catch(() => {
                  toast.error("Could not save your default tradition.");
                });
              }}
            />
          </div>
```

(Reusing `styles.pauseControl` and `styles.label` — check `profile-page.module.css` for these class names before writing the JSX; if `styles.label` isn't defined there, use a plain `<span>` with no class instead of introducing new CSS for this plan.)

- [ ] **Step 2: Check the CSS module for the reused class names**

Run: `grep -n "pauseControl\|^\.label" apps/web/src/components/profile/profile-page.module.css`

If `.label` doesn't exist in that file, remove `className={styles.label}` from the `<span>` in Step 1 (leave the `<span>` unstyled — matching the plan's YAGNI constraint of not inventing new CSS for this feature).

- [ ] **Step 3: Run type-check**

Run: `pnpm check-types`
Expected: passes with no errors.

- [ ] **Step 4: Manually verify in the browser**

With the dev server running, sign in as a user (any plan tier, any profile opt-in state):
- Go to `/profile`.
- Confirm the "Default tradition" control appears near the top of the page (in the header area), regardless of whether you're on the free plan or haven't opted into the Theological Profile.
- Change the selection; confirm no error toast appears and the choice persists across a page reload.
- Go to `/chat`, start a new Q&A study: confirm the pre-filled tradition (from Task 3) now matches the newly changed default.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/profile/profile-page.tsx
git commit -m "feat(web): edit default tradition on /profile"
```

---

## Final verification

- [ ] Run `pnpm --filter @theologia/backend test` — all backend tests pass, including the new `userPreferences.test.ts`.
- [ ] Run `pnpm check-types` — no type errors across the monorepo.
- [ ] Full manual flow: sign up with a fresh account and a chosen tradition → land on `/chat` with that tradition pre-filled on a new study → change the default on `/profile` → confirm the next new study reflects the change → confirm changing a single conversation's tradition via `SetupPicker` does not alter the saved default.

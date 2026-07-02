# Convex + Anthropic Chat Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the `/chat` surface to real streaming AI replies via the Convex AI Agent component + Anthropic Claude Sonnet 4.6, with per-mode system prompts producing the existing typed `Block[]` formats through a lightweight tag vocabulary.

**Architecture:** The backend gains a `conversations` table (mode + locked setup + agent `threadId`) and a `chat.ts` module where mutations save user messages and schedule an internal action that streams the model's tagged-text reply with delta persistence. The client parses the tagged stream into the existing `Block` union incrementally; mock seed conversations remain untouched in local state while new conversations take the live Convex path.

**Tech Stack:** Convex (`@convex-dev/agent` component), AI SDK (`ai`, `@ai-sdk/anthropic`, model `claude-sonnet-4-6`), Next.js 16 + React 19, vitest, bun workspaces + turbo.

**Spec:** `docs/superpowers/specs/2026-07-02-convex-anthropic-chat-design.md`

## Global Constraints

- Package manager is **bun**; the repo is a turbo monorepo. Web dev server runs on **port 3001**.
- Commits go **directly to `master`** (Dylan's workflow — no feature branch).
- Model string is exactly **`claude-sonnet-4-6`**.
- **Mock seed conversations and scripts must remain functional and visually unchanged** throughout. Nothing under `apps/web/src/components/chat/lib/scripts/` or `mock-chat.ts` is deleted or modified.
- `apps/web/src/components/chat/message-blocks.tsx` renders the existing `Block` union and must not change.
- Known pre-existing build blocker in `packages/backend/convex/polar.ts` (from project memory): if `convex dev` / typecheck fails there, **do not fix it** — report it and validate your own files with `bunx tsc --noEmit` instead.
- Web already imports backend files by deep path (e.g. `@theologia/backend/convex/_generated/api`) — new shared modules use the same style.
- After any backend file change, Convex codegen/push happens via `cd packages/backend && bunx convex dev --once`.

---

### Task 1: Move shared study data to the backend package

The static tradition/document/collection/purpose data currently lives in the web app but is needed server-side by the prompt builders. Move it to a plain TS module in the backend; the web files become re-export shims so no import site elsewhere changes.

**Files:**
- Create: `packages/backend/convex/lib/studyData.ts`
- Modify: `apps/web/src/components/chat/lib/frameworks.ts` (becomes re-export shim)
- Modify: `apps/web/src/components/chat/lib/modes.ts` (imports shared data, keeps UI copy)
- Modify: `apps/web/src/components/chat/lib/chat-state.ts` (re-exports moved types + `deriveTitle`)
- Test: existing web tests (`apps/web/src/components/chat/lib/*.test.ts`) must stay green

**Interfaces:**
- Consumes: nothing (pure data module)
- Produces (from `packages/backend/convex/lib/studyData.ts`):
  - `type ModeId = "qa" | "devils-advocate" | "comparison" | "debate-prep" | "catechism" | "resources" | "library" | "scripture-study"`
  - `type SetupKind = "tradition" | "versus" | "multi-tradition" | "document" | "tradition-purpose" | "collection"`
  - `interface ConversationSetup { framework?: string; subTradition?: string; opposing?: string; traditions?: string[]; document?: string; purpose?: string; collection?: string }`
  - `interface Framework { id: string; label: string; subTraditions: SubTradition[] }`, `interface SubTradition { id: string; label: string }`
  - `const FRAMEWORKS: Framework[]`, `const DOCUMENTS/COLLECTIONS/PURPOSES: { id: string; label: string }[]`
  - `const MODE_SETUP: Record<ModeId, SetupKind>`
  - `getFramework(id: string): Framework | undefined`
  - `getSubTradition(frameworkId: string, subId: string): SubTradition | undefined`
  - `isSetupValid(mode: ModeId, setup: ConversationSetup): boolean`
  - `deriveTitle(text: string): string`

- [ ] **Step 1: Create `packages/backend/convex/lib/studyData.ts`**

Structure (the elided arrays are **moved verbatim** from the named sources — do not retype them):

```ts
/**
 * Shared static study data — the single source of truth for traditions,
 * documents, collections, and purposes. The Convex prompt builders and the
 * web chat UI both import from here.
 */

export type ModeId =
  | "qa"
  | "devils-advocate"
  | "comparison"
  | "debate-prep"
  | "catechism"
  | "resources"
  | "library"
  | "scripture-study";

/** Which setup controls the composer shows for a mode. */
export type SetupKind =
  | "tradition"
  | "versus"
  | "multi-tradition"
  | "document"
  | "tradition-purpose"
  | "collection";

/** The mode-specific choices made on the new-study screen. */
export interface ConversationSetup {
  framework?: string;
  subTradition?: string;
  opposing?: string;
  traditions?: string[];
  document?: string;
  purpose?: string;
  collection?: string;
}

export interface SubTradition {
  id: string;
  label: string;
}

export interface Framework {
  id: string;
  label: string;
  subTraditions: SubTradition[];
}

// … `sub()` helper + FRAMEWORKS array + getFramework + getSubTradition:
//    moved VERBATIM from apps/web/src/components/chat/lib/frameworks.ts
//    (lines 12–134, including all doc comments)

// … DOCUMENTS, COLLECTIONS, PURPOSES arrays:
//    moved VERBATIM from apps/web/src/components/chat/lib/modes.ts
//    (lines 174–205, including doc comments)

export const MODE_SETUP: Record<ModeId, SetupKind> = {
  qa: "tradition",
  "devils-advocate": "versus",
  comparison: "multi-tradition",
  "debate-prep": "versus",
  catechism: "document",
  resources: "tradition-purpose",
  library: "collection",
  "scripture-study": "tradition",
};

/** Whether the new-study setup is complete enough to send the first message. */
export function isSetupValid(mode: ModeId, setup: ConversationSetup): boolean {
  switch (MODE_SETUP[mode]) {
    case "tradition":
      return Boolean(setup.framework);
    case "versus":
      return Boolean(
        setup.framework &&
          setup.opposing &&
          setup.opposing !== setup.framework,
      );
    case "multi-tradition": {
      const traditions = setup.traditions ?? [];
      return (
        traditions.length >= 2 &&
        traditions.length <= 4 &&
        new Set(traditions).size === traditions.length
      );
    }
    case "document":
      return Boolean(setup.document);
    case "tradition-purpose":
      return Boolean(setup.framework && setup.purpose);
    case "collection":
      return true;
  }
}

const TITLE_MAX = 48;

/**
 * Derive a sidebar title from the first line of a message, trimmed and
 * truncated. Empty input falls back to a neutral default.
 */
export function deriveTitle(text: string): string {
  const firstLine = text.split("\n")[0]?.trim() ?? "";
  if (firstLine.length === 0) return "New conversation";
  if (firstLine.length <= TITLE_MAX) return firstLine;
  return `${firstLine.slice(0, TITLE_MAX).trimEnd()}…`;
}
```

- [ ] **Step 2: Turn `apps/web/src/components/chat/lib/frameworks.ts` into a re-export shim**

Replace the entire file with:

```ts
export {
  FRAMEWORKS,
  getFramework,
  getSubTradition,
  type Framework,
  type SubTradition,
} from "@theologia/backend/convex/lib/studyData";
```

- [ ] **Step 3: Update `apps/web/src/components/chat/lib/modes.ts`**

- Delete the local `SetupKind` type, the `DOCUMENTS`/`COLLECTIONS`/`PURPOSES` arrays, `isSetupValid`, and the `TITLE`-unrelated duplicates now living in the backend.
- Add at the top:

```ts
import {
  MODE_SETUP,
  type ConversationSetup,
  type ModeId,
  type SetupKind,
} from "@theologia/backend/convex/lib/studyData";

export {
  DOCUMENTS,
  COLLECTIONS,
  PURPOSES,
  isSetupValid,
  type SetupKind,
} from "@theologia/backend/convex/lib/studyData";
```

- Keep the `Mode` interface and `MODES` array exactly as they are (UI copy stays in the web app), but each entry's `setup` field must now read from the shared map so there is one source of truth, e.g. `setup: MODE_SETUP.qa` for the qa entry, `setup: MODE_SETUP["devils-advocate"]` for devils-advocate, and so on for all eight.
- Keep `getMode` and `describeSetup` unchanged (they are display-only). Remove the now-duplicate imports of `Conversation, ConversationSetup, ModeId` from `./chat-state` only if unused — `describeSetup` still needs `Conversation` from `./chat-state`.

- [ ] **Step 4: Update `apps/web/src/components/chat/lib/chat-state.ts`**

- Delete the local `ModeId` type, `ConversationSetup` interface, `TITLE_MAX`, and `deriveTitle` function.
- Add:

```ts
export {
  deriveTitle,
  type ConversationSetup,
  type ModeId,
} from "@theologia/backend/convex/lib/studyData";
import type {
  ConversationSetup,
  ModeId,
} from "@theologia/backend/convex/lib/studyData";
```

(The `import type` line is needed because `Conversation`/`createConversation` in this file reference the types locally.)

- [ ] **Step 5: Run the web test suite and typecheck**

Run: `cd apps/web && bun run test && bunx tsc --noEmit`
Expected: all existing tests PASS (frameworks, modes, chat-state, scripts, exchanges tests exercise the shims). If Next/vitest fails to resolve the deep import, add `transpilePackages: ["@theologia/backend"]` to `apps/web/next.config.ts` — but vitest and Next 16 both handle workspace TS sources in this repo already (`@theologia/ui` ships raw `.tsx`), so this should not be needed.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "refactor: move shared study data to backend package"
```

---

### Task 2: Install the Agent component, schema, and env key

**Files:**
- Modify: `packages/backend/package.json` (deps)
- Modify: `packages/backend/convex/convex.config.ts`
- Modify: `packages/backend/convex/schema.ts`

**Interfaces:**
- Produces:
  - Convex component `components.agent` available in generated API
  - `conversations` table with indexes `by_user` and `by_thread`
  - Exported validators from `schema.ts`: `vMode`, `vSetup`
  - Deployment env var `ANTHROPIC_API_KEY`

- [ ] **Step 1: Add dependencies**

Run: `cd packages/backend && bun add @convex-dev/agent @ai-sdk/anthropic ai`
Expected: three deps added to `packages/backend/package.json`, lockfile updated.

- [ ] **Step 2: Register the agent component in `convex.config.ts`**

```ts
import agent from "@convex-dev/agent/convex.config";
import betterAuth from "@convex-dev/better-auth/convex.config";
import polar from "@convex-dev/polar/convex.config.js";
import { defineApp } from "convex/server";

const app = defineApp();
app.use(betterAuth);
app.use(polar);
app.use(agent);

export default app;
```

- [ ] **Step 3: Add the `conversations` table to `schema.ts`**

```ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const vMode = v.union(
  v.literal("qa"),
  v.literal("devils-advocate"),
  v.literal("comparison"),
  v.literal("debate-prep"),
  v.literal("catechism"),
  v.literal("resources"),
  v.literal("library"),
  v.literal("scripture-study"),
);

/** Mirrors ConversationSetup from lib/studyData.ts. */
export const vSetup = {
  framework: v.optional(v.string()),
  subTradition: v.optional(v.string()),
  opposing: v.optional(v.string()),
  traditions: v.optional(v.array(v.string())),
  document: v.optional(v.string()),
  purpose: v.optional(v.string()),
  collection: v.optional(v.string()),
};

export default defineSchema({
  waitlist: defineTable({
    email: v.string(),
  }).index("by_email", ["email"]),

  conversations: defineTable({
    userId: v.string(),
    threadId: v.string(),
    mode: vMode,
    title: v.string(),
    ...vSetup,
  })
    .index("by_user", ["userId"])
    .index("by_thread", ["threadId"]),
});
```

- [ ] **Step 4: Push + codegen**

Run: `cd packages/backend && bunx convex dev --once`
Expected: component registered, schema pushed, `_generated` updated, exit 0.
If this fails inside `polar.ts` (known pre-existing blocker): note the exact error for the final report, and verify your own changes compile with `cd packages/backend && bunx tsc --noEmit` instead. Do not edit `polar.ts`.

- [ ] **Step 5: Ensure `ANTHROPIC_API_KEY` is set on the deployment**

Run: `cd packages/backend && bunx convex env list`
If `ANTHROPIC_API_KEY` is absent, **stop and ask Dylan for the key**, then:
Run: `cd packages/backend && bunx convex env set ANTHROPIC_API_KEY <key>`
Expected: key listed in `convex env list` output.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(backend): install convex agent component, conversations schema"
```

---

### Task 3: Per-mode system prompt builders

**Files:**
- Create: `packages/backend/convex/lib/prompts.ts`
- Create: `packages/backend/vitest.config.ts`
- Modify: `packages/backend/package.json` (add `vitest` devDep + `test` script)
- Test: `packages/backend/convex/lib/prompts.test.ts`

**Interfaces:**
- Consumes (Task 1): `getFramework`, `getSubTradition`, `DOCUMENTS`, `COLLECTIONS`, `PURPOSES`, `type ModeId`, `type ConversationSetup` from `./studyData`
- Produces: `buildSystemPrompt(mode: ModeId, setup: ConversationSetup): string`

- [ ] **Step 1: Add vitest to the backend package**

Run: `cd packages/backend && bun add -d vitest`

Create `packages/backend/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["convex/**/*.test.ts"],
  },
});
```

Add to `packages/backend/package.json` scripts: `"test": "vitest run"`.

- [ ] **Step 2: Write the failing tests**

Create `packages/backend/convex/lib/prompts.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { buildSystemPrompt } from "./prompts";

describe("buildSystemPrompt", () => {
  it("every mode includes the persona, tag spec, and followups guidance", () => {
    const modes = [
      "qa",
      "devils-advocate",
      "comparison",
      "debate-prep",
      "catechism",
      "resources",
      "library",
      "scripture-study",
    ] as const;
    for (const mode of modes) {
      const prompt = buildSystemPrompt(mode, {
        framework: "reformed",
        opposing: "arminian-wesleyan",
        traditions: ["reformed", "lutheran"],
        document: "westminster",
        purpose: "sermon-prep",
        collection: "ante-nicene",
      });
      expect(prompt).toContain("Theologia");
      expect(prompt).toContain("<scripture");
      expect(prompt).toContain("<followups>");
      expect(prompt).toContain("only when");
    }
  });

  it("qa speaks from within the tradition, with sub-tradition refinement", () => {
    const prompt = buildSystemPrompt("qa", {
      framework: "reformed",
      subTradition: "presbyterian",
    });
    expect(prompt).toContain("Reformed");
    expect(prompt).toContain("Presbyterian");
  });

  it("devils-advocate names both traditions and demands objection points", () => {
    const prompt = buildSystemPrompt("devils-advocate", {
      framework: "reformed",
      opposing: "arminian-wesleyan",
    });
    expect(prompt).toContain("Reformed");
    expect(prompt).toContain("Arminian");
    expect(prompt).toContain('kind="objection"');
    expect(prompt).toContain("strawman");
  });

  it("comparison lists every selected tradition", () => {
    const prompt = buildSystemPrompt("comparison", {
      traditions: ["reformed", "lutheran", "roman-catholic"],
    });
    expect(prompt).toContain("Reformed");
    expect(prompt).toContain("Lutheran");
    expect(prompt).toContain("Roman Catholic");
    expect(prompt).toContain("<comparison>");
  });

  it("catechism names the document and article tag", () => {
    const prompt = buildSystemPrompt("catechism", { document: "westminster" });
    expect(prompt).toContain("Westminster Standards");
    expect(prompt).toContain("<article");
  });

  it("resources names tradition, purpose, and the resources tag", () => {
    const prompt = buildSystemPrompt("resources", {
      framework: "baptist",
      purpose: "sermon-prep",
    });
    expect(prompt).toContain("Baptist");
    expect(prompt).toContain("Sermon prep");
    expect(prompt).toContain("<resources>");
  });

  it("library names the collection and source tag", () => {
    const prompt = buildSystemPrompt("library", { collection: "ante-nicene" });
    expect(prompt).toContain("Ante-Nicene Fathers");
    expect(prompt).toContain("<source");
  });

  it("library works with no collection selected (all collections)", () => {
    const prompt = buildSystemPrompt("library", {});
    expect(prompt).toContain("<source");
  });

  it("scripture-study includes lexicon and history tags", () => {
    const prompt = buildSystemPrompt("scripture-study", {
      framework: "lutheran",
    });
    expect(prompt).toContain("Lutheran");
    expect(prompt).toContain("<lexicon>");
    expect(prompt).toContain("<history");
  });

  it("unknown labels degrade gracefully", () => {
    const prompt = buildSystemPrompt("qa", { framework: "not-a-real-id" });
    expect(prompt).toContain("Theologia");
    expect(prompt).not.toContain("undefined");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd packages/backend && bun run test`
Expected: FAIL — cannot resolve `./prompts`.

- [ ] **Step 4: Implement `packages/backend/convex/lib/prompts.ts`**

```ts
import {
  COLLECTIONS,
  DOCUMENTS,
  getFramework,
  getSubTradition,
  PURPOSES,
  type ConversationSetup,
  type ModeId,
} from "./studyData";

const PERSONA = `You are Theologia, a theological study companion for serious students of Christian doctrine.

Voice and posture:
- Write with scholarly warmth: precise, unhurried prose that takes the reader seriously.
- Represent every tradition through its best exegetes and strongest arguments — never a strawman.
- Cite Scripture by book, chapter, and verse. Name theologians, councils, confessions, and dates concretely.
- Where the church has argued a question for centuries, say so — historical depth is a feature, not a digression.
- Never invent quotations or citations. If you are not certain of a source's wording, characterize it without quoting.
- Answer in flowing prose by default. Markdown headings and bullet lists are not your idiom; the structured tags below are.`;

const TAG_SPEC = `## Output format

You write plain prose interleaved with a small tag vocabulary. Everything outside a tag renders as prose paragraphs. Each tag renders as a distinct visual card in the app, so use a tag ONLY when the content genuinely is that kind of thing — most replies are mostly prose, and many replies need no tags at all. Never wrap your whole answer in tags, never nest one tag inside another, and never use any tag not listed here.

<scripture ref="Romans 9:19">You will say to me then, "Why does he still find fault? For who can resist his will?"</scripture>
Use when quoting a Bible passage at length (not for passing verse references in prose — keep those inline).

<history heading="This debate has a history">Augustine against Pelagius, Dort against the Remonstrants — the church has run this argument for sixteen centuries.</history>
Use for a short church-history aside that locates the discussion in the tradition's story. At most one per reply, and only when the history genuinely illuminates.

<lexicon><entry term="ἐξουσία" translit="exousia" gloss="right, authority" /><entry term="σκεῦος" translit="skeuos" gloss="vessel" /></lexicon>
Use for original-language word studies (Greek/Hebrew/Latin). Self-closing entries only.

<comparison><column tradition="Reformed"><position>One or two sentences stating the position.</position><texts>Rom 9:16; Eph 2:8-9</texts><theologians>Calvin, Turretin, Bavinck</theologians></column></comparison>
Use ONLY when laying traditions side by side — one column per tradition, every column complete.

<points kind="objection"><point title="Romans 9 concerns corporate vocation" weight="Their strongest text-based argument">Body of the point in one short paragraph.</point></points>
Use for ranked objections (kind="objection") or a tradition's answers to them (kind="response"). The weight attribute is optional — use it to say how much the point matters.

<resources><item title="The Bondage of the Will" author="Martin Luther" tier="scholarly">Why this book, in one sentence.</item></resources>
Use only for reading recommendations. tier must be one of: introductory, intermediate, scholarly.

<source work="Against Heresies" author="Irenaeus of Lyons" citation="Book IV, ch. 37">Verbatim excerpt from the primary source.</source>
Use when quoting a primary source (a Father, council, confession) at length. Only quote text you are confident is genuine.

<article source="Westminster Confession" label="Chapter III, §1" proofs="Eph 1:11; Rom 11:33">The confessional text, quoted or closely paraphrased.</article>
Use when walking through a confessional or catechetical document article by article.

<followups><q label="How has my tradition read this?">How has my tradition historically read this passage?</q></followups>
When the reply naturally invites a next step, end with ONE followups tag holding one or two questions. label is the short chip text (5-8 words); the body is the full question that will be sent as the user's next message. Include followups only when a genuinely good next question exists — not on every reply, and never after a simple factual answer.

Formatting rules:
- Tags always occupy their own lines, at the top level of the reply.
- Inside tags, write plain text only — no markdown, no nested tags.
- Attribute values must use double quotes and must not contain double quotes.`;

function frameworkLabel(id?: string): string {
  return id ? (getFramework(id)?.label ?? id) : "";
}

function traditionClause(setup: ConversationSetup): string {
  const base = frameworkLabel(setup.framework);
  if (!base) return "the user's tradition";
  const sub =
    setup.framework && setup.subTradition
      ? getSubTradition(setup.framework, setup.subTradition)?.label
      : undefined;
  return sub ? `the ${base} tradition (specifically ${sub})` : `the ${base} tradition`;
}

const MODE_SECTIONS: Record<ModeId, (setup: ConversationSetup) => string> = {
  qa: (setup) => `## Mode: Q&A

The user has locked in ${traditionClause(setup)}. Answer every question from within that tradition — its confessions, its exegetes, its history — as its best teachers would. Be candid about intramural disagreement inside the tradition, and note (briefly, fairly) where other traditions differ when it serves understanding. Scripture quotations and history asides are welcome when apt.`,

  "devils-advocate": (setup) => `## Mode: Devil's Advocate

The user holds ${traditionClause(setup)}. You argue the case of the ${frameworkLabel(setup.opposing) || "opposing"} tradition against the doctrine or passage the user names — the strongest form of each argument, as a serious, well-read ${frameworkLabel(setup.opposing) || "opposing"} theologian would actually make it. Never a strawman; never soften the challenge.

Present objections as <points kind="objection"> with sharp titles. When the user asks how their own tradition answers, give the real answers of its best exegetes as <points kind="response">, in the same order. When pressed further, keep the debate going in character — say where the argument migrates next and why. A history aside placing the debate in the church's story is often warranted here.`,

  comparison: (setup) => {
    const labels = (setup.traditions ?? []).map(frameworkLabel).filter(Boolean);
    const list = labels.join(", ");
    return `## Mode: Comparison

The user chose these traditions to compare: ${list || "the traditions named in their message"}. For the doctrine or passage they raise, produce a <comparison> block with exactly one column per selected tradition — ${list || "each"} — every column complete (position, key texts, representative theologians), none privileged, all represented by their best. Frame the comparison with prose before and after: what the real point of divergence is, and where the traditions agree more than their rhetoric suggests.`;
  },

  "debate-prep": (setup) => `## Mode: Debate Prep

The user is preparing to defend a thesis from within ${traditionClause(setup)} against ${frameworkLabel(setup.opposing) || "an opposing"} interlocutors. Rank the objections they will actually face — strongest first — as <points kind="objection">, each with a weight attribute saying how central it is. Then drill them: give the tradition's best responses as <points kind="response">, and when the user answers in their own words, assess the answer candidly and press where a capable opponent would press.`,

  catechism: (setup) => {
    const doc = DOCUMENTS.find((d) => d.id === setup.document)?.label;
    return `## Mode: Catechism

You are tutoring the user through ${doc ?? "their chosen confessional document"}. Quote the document's own text in <article> blocks (source="${doc ?? "the document"}", label naming the question/chapter/section, proofs listing its Scripture proofs). Explain each article in plain language, cross-reference related articles, and give historical context for why it was written. When the user has worked through a stretch of material, quiz them on it — ask one question at a time, then assess their answer honestly before moving on.`;
  },

  resources: (setup) => {
    const purpose = PURPOSES.find((p) => p.id === setup.purpose)?.label;
    return `## Mode: Resources

The user studies within ${traditionClause(setup)}, and their purpose is: ${purpose ?? "personal study"}. Recommend reading matched to both — primary sources first, then secondary literature — as <resources> blocks with honest tier labels (introductory, intermediate, scholarly) and a one-sentence note saying why each earns its place. Three to six items is the right range; a shelf, not a bibliography. Prose around the block should say how to read them and in what order.`;
  },

  library: (setup) => {
    const collection = COLLECTIONS.find((c) => c.id === setup.collection)?.label;
    return `## Mode: Library

The user is searching the primary sources${collection ? ` — specifically the ${collection}` : ""}. Answer from the primary texts themselves: quote the relevant passages in <source> blocks (work, author, citation precise enough to look up), then explain each excerpt in plain language — what it says, what it does not say, and how it has been read since. Only quote text you are confident is genuine; when uncertain, characterize the passage instead of quoting. Prefer two or three well-chosen excerpts over a catalogue.`;
  },

  "scripture-study": (setup) => `## Mode: Scripture Study

The user brings a passage and studies within ${traditionClause(setup)}. Go deep in the text: quote it in a <scripture> block, give original-language notes in a <lexicon> block where the vocabulary matters, supply historical and literary context, present the tradition's reading of the passage, and bring in the Fathers or later interpreters via <source> blocks when their voice is illuminating. A <history> aside is warranted when the passage has been a battleground. Structure the study as prose that moves through the text, not as a list of disconnected facts.`,
};

export function buildSystemPrompt(
  mode: ModeId,
  setup: ConversationSetup,
): string {
  return [PERSONA, TAG_SPEC, MODE_SECTIONS[mode](setup)].join("\n\n");
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd packages/backend && bun run test`
Expected: PASS (all prompts tests).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(backend): per-mode system prompt builders with tag vocabulary"
```

---

### Task 4: Convex chat functions (agent, mutations, queries, streaming action)

**Files:**
- Create: `packages/backend/convex/chat.ts`

**Interfaces:**
- Consumes: `vMode`, `vSetup` from `./schema` (Task 2); `buildSystemPrompt` (Task 3); `deriveTitle`, `isSetupValid` (Task 1); `authComponent` from `./auth`
- Produces (public API used by the web app in Task 6):
  - `api.chat.createConversation({ mode, setup, firstMessage }) => Id<"conversations">`
  - `api.chat.sendMessage({ conversationId: Id<"conversations">, text: string }) => void`
  - `api.chat.listConversations({}) => Doc<"conversations">[]` (newest first; `[]` when signed out)
  - `api.chat.getConversation({ conversationId }) => Doc<"conversations"> | null`
  - `api.chat.listThreadMessages({ threadId, paginationOpts, streamArgs })` — the agent-component-shaped query consumed by `useUIMessages`

- [ ] **Step 1: Create `packages/backend/convex/chat.ts`**

```ts
import { anthropic } from "@ai-sdk/anthropic";
import {
  Agent,
  createThread,
  listUIMessages,
  saveMessage,
  syncStreams,
  vStreamArgs,
} from "@convex-dev/agent";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";

import { components, internal } from "./_generated/api";
import {
  internalAction,
  internalQuery,
  mutation,
  query,
  type QueryCtx,
  type MutationCtx,
} from "./_generated/server";
import { authComponent } from "./auth";
import { buildSystemPrompt } from "./lib/prompts";
import { deriveTitle, isSetupValid } from "./lib/studyData";
import { vMode, vSetup } from "./schema";

export const theologiaAgent = new Agent(components.agent, {
  name: "Theologia",
  languageModel: anthropic("claude-sonnet-4-6"),
});

const REPLY_ERROR_TEXT =
  "Something went wrong while composing this reply. Please send your message again.";

async function requireUser(ctx: QueryCtx | MutationCtx) {
  const user = await authComponent.safeGetAuthUser(ctx);
  if (!user) throw new Error("Not authenticated");
  return user;
}

export const createConversation = mutation({
  args: {
    mode: vMode,
    setup: v.object(vSetup),
    firstMessage: v.string(),
  },
  returns: v.id("conversations"),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!isSetupValid(args.mode, args.setup)) {
      throw new Error("Incomplete setup for this mode");
    }
    const text = args.firstMessage.trim();
    if (!text) throw new Error("Message is empty");

    const threadId = await createThread(ctx, components.agent, {
      userId: user._id,
    });
    const { messageId } = await saveMessage(ctx, components.agent, {
      threadId,
      prompt: text,
    });
    const conversationId = await ctx.db.insert("conversations", {
      userId: user._id,
      threadId,
      mode: args.mode,
      title: deriveTitle(text),
      ...args.setup,
    });
    await ctx.scheduler.runAfter(0, internal.chat.streamReply, {
      conversationId,
      threadId,
      promptMessageId: messageId,
    });
    return conversationId;
  },
});

export const sendMessage = mutation({
  args: {
    conversationId: v.id("conversations"),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.userId !== user._id) {
      throw new Error("Conversation not found");
    }
    const text = args.text.trim();
    if (!text) throw new Error("Message is empty");

    const { messageId } = await saveMessage(ctx, components.agent, {
      threadId: conversation.threadId,
      prompt: text,
    });
    await ctx.scheduler.runAfter(0, internal.chat.streamReply, {
      conversationId: args.conversationId,
      threadId: conversation.threadId,
      promptMessageId: messageId,
    });
  },
});

export const listConversations = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return [];
    return await ctx.db
      .query("conversations")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();
  },
});

export const getConversation = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return null;
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.userId !== user._id) return null;
    return conversation;
  },
});

export const listThreadMessages = query({
  args: {
    threadId: v.string(),
    paginationOpts: paginationOptsValidator,
    streamArgs: vStreamArgs,
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const conversation = await ctx.db
      .query("conversations")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .unique();
    if (!conversation || conversation.userId !== user._id) {
      throw new Error("Thread not found");
    }
    const paginated = await listUIMessages(ctx, components.agent, args);
    const streams = await syncStreams(ctx, components.agent, args);
    return { ...paginated, streams };
  },
});

export const getConversationInternal = internalQuery({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => ctx.db.get(args.conversationId),
});

export const streamReply = internalAction({
  args: {
    conversationId: v.id("conversations"),
    threadId: v.string(),
    promptMessageId: v.string(),
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.runQuery(
      internal.chat.getConversationInternal,
      { conversationId: args.conversationId },
    );
    if (!conversation) return;

    const system = buildSystemPrompt(conversation.mode, conversation);
    try {
      const result = await theologiaAgent.streamText(
        ctx,
        { threadId: args.threadId },
        { promptMessageId: args.promptMessageId, system },
        { saveStreamDeltas: true },
      );
      await result.consumeStream();
    } catch (error) {
      console.error("streamReply failed", error);
      // Surface a visible assistant-side error so the client is never left hanging.
      await saveMessage(ctx, components.agent, {
        threadId: args.threadId,
        message: { role: "assistant", content: REPLY_ERROR_TEXT },
      });
    }
  },
});
```

API notes for the implementer (verified against the current `@convex-dev/agent` docs):
- `createThread(ctx, components.agent, { userId })`, `saveMessage(ctx, components.agent, { threadId, prompt })` → `{ messageId }`, and `agent.streamText(ctx, { threadId }, { promptMessageId, system }, { saveStreamDeltas: true })` are the documented shapes.
- If the installed version's types reject per-call `system`, construct the `Agent` inside the action with `instructions: system` instead (the constructor accepts `instructions`); leave a comment saying why.
- If `QueryCtx`/`MutationCtx` type imports differ, use the generated names from `./_generated/server`.

- [ ] **Step 2: Push + typecheck**

Run: `cd packages/backend && bunx convex dev --once`
Expected: exit 0, `chat` functions listed in the deployment. (Same `polar.ts` caveat as Task 2 — if blocked there, validate with `bunx tsc --noEmit` and report.)

- [ ] **Step 3: Smoke-test from the CLI**

Run: `cd packages/backend && bunx convex run chat:listConversations '{}'`
Expected: `[]` (unauthenticated path returns empty list, proving the function executes).

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(backend): chat mutations, queries, and streaming reply action"
```

---

### Task 5: Client-side tagged-stream parser (TDD)

**Files:**
- Create: `apps/web/src/components/chat/lib/parse-blocks.ts`
- Test: `apps/web/src/components/chat/lib/parse-blocks.test.ts`

**Interfaces:**
- Consumes: `type Block`, `type Action` from `./chat-state`
- Produces:
  - `interface ParsedMessage { blocks: Block[]; actions: Action[]; pending: boolean }`
  - `parseBlocks(text: string, opts?: { partial?: boolean }): ParsedMessage`

`pending` is true when, in partial mode, the text ends inside an unclosed tag (that trailing content is withheld from `blocks`).

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/components/chat/lib/parse-blocks.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { parseBlocks } from "./parse-blocks";

describe("parseBlocks — prose", () => {
  it("plain text becomes prose blocks split on blank lines", () => {
    const { blocks, actions, pending } = parseBlocks(
      "First paragraph.\n\nSecond paragraph.",
    );
    expect(blocks).toEqual([
      { type: "prose", text: "First paragraph." },
      { type: "prose", text: "Second paragraph." },
    ]);
    expect(actions).toEqual([]);
    expect(pending).toBe(false);
  });

  it("empty text yields nothing", () => {
    expect(parseBlocks("")).toEqual({ blocks: [], actions: [], pending: false });
  });
});

describe("parseBlocks — structured tags", () => {
  it("scripture", () => {
    const { blocks } = parseBlocks(
      '<scripture ref="Romans 9:19">You will say to me then…</scripture>',
    );
    expect(blocks).toEqual([
      {
        type: "scripture",
        reference: "Romans 9:19",
        text: "You will say to me then…",
      },
    ]);
  });

  it("history", () => {
    const { blocks } = parseBlocks(
      '<history heading="An old debate">Augustine against Pelagius.</history>',
    );
    expect(blocks).toEqual([
      { type: "history", heading: "An old debate", text: "Augustine against Pelagius." },
    ]);
  });

  it("lexicon with self-closing entries", () => {
    const { blocks } = parseBlocks(
      '<lexicon><entry term="ἐξουσία" translit="exousia" gloss="right, authority" /><entry term="σκεῦος" translit="skeuos" gloss="vessel" /></lexicon>',
    );
    expect(blocks).toEqual([
      {
        type: "lexicon",
        entries: [
          { term: "ἐξουσία", translit: "exousia", gloss: "right, authority" },
          { term: "σκεῦος", translit: "skeuos", gloss: "vessel" },
        ],
      },
    ]);
  });

  it("comparison columns with nested fields", () => {
    const { blocks } = parseBlocks(
      '<comparison><column tradition="Reformed"><position>Monergism.</position><texts>Rom 9:16</texts><theologians>Calvin</theologians></column><column tradition="Lutheran"><position>Means of grace.</position><texts>Rom 10:17</texts><theologians>Chemnitz</theologians></column></comparison>',
    );
    expect(blocks).toEqual([
      {
        type: "comparison",
        columns: [
          { tradition: "Reformed", position: "Monergism.", texts: "Rom 9:16", theologians: "Calvin" },
          { tradition: "Lutheran", position: "Means of grace.", texts: "Rom 10:17", theologians: "Chemnitz" },
        ],
      },
    ]);
  });

  it("points with kind and optional weight", () => {
    const { blocks } = parseBlocks(
      '<points kind="objection"><point title="Corporate vocation" weight="Strongest">Body one.</point><point title="Second">Body two.</point></points>',
    );
    expect(blocks).toEqual([
      {
        type: "points",
        kind: "objection",
        items: [
          { title: "Corporate vocation", body: "Body one.", weight: "Strongest" },
          { title: "Second", body: "Body two." },
        ],
      },
    ]);
  });

  it("points defaults invalid kind to objection", () => {
    const { blocks } = parseBlocks(
      '<points kind="rebuttal"><point title="T">B.</point></points>',
    );
    expect(blocks[0]).toMatchObject({ type: "points", kind: "objection" });
  });

  it("resources with tier validation", () => {
    const { blocks } = parseBlocks(
      '<resources><item title="Institutes" author="John Calvin" tier="scholarly">The fountainhead.</item><item title="Bad Tier" author="A" tier="expert">Note.</item></resources>',
    );
    expect(blocks).toEqual([
      {
        type: "resources",
        items: [
          { title: "Institutes", author: "John Calvin", tier: "scholarly", note: "The fountainhead." },
          { title: "Bad Tier", author: "A", tier: "introductory", note: "Note." },
        ],
      },
    ]);
  });

  it("source", () => {
    const { blocks } = parseBlocks(
      '<source work="Against Heresies" author="Irenaeus" citation="IV.37">Excerpt text.</source>',
    );
    expect(blocks).toEqual([
      { type: "source", work: "Against Heresies", author: "Irenaeus", citation: "IV.37", excerpt: "Excerpt text." },
    ]);
  });

  it("article with proofs split on semicolons", () => {
    const { blocks } = parseBlocks(
      '<article source="Westminster Confession" label="III.1" proofs="Eph 1:11; Rom 11:33">God ordains.</article>',
    );
    expect(blocks).toEqual([
      {
        type: "article",
        source: "Westminster Confession",
        label: "III.1",
        body: "God ordains.",
        proofs: ["Eph 1:11", "Rom 11:33"],
      },
    ]);
  });

  it("article without proofs omits the field", () => {
    const { blocks } = parseBlocks(
      '<article source="S" label="L">Body.</article>',
    );
    expect(blocks[0]).toEqual({ type: "article", source: "S", label: "L", body: "Body." });
  });

  it("prose interleaves around tags", () => {
    const { blocks } = parseBlocks(
      'Before.\n\n<scripture ref="John 1:1">In the beginning was the Word.</scripture>\n\nAfter.',
    );
    expect(blocks.map((b) => b.type)).toEqual(["prose", "scripture", "prose"]);
  });

  it("unescapes XML entities in attributes and bodies", () => {
    const { blocks } = parseBlocks(
      '<history heading="Faith &amp; works">Law &lt; Gospel &amp; grace.</history>',
    );
    expect(blocks).toEqual([
      { type: "history", heading: "Faith & works", text: "Law < Gospel & grace." },
    ]);
  });
});

describe("parseBlocks — followups", () => {
  it("maps q tags to actions with label and prefill", () => {
    const { blocks, actions } = parseBlocks(
      'Answer.\n\n<followups><q label="How has my tradition read this?">How has my tradition historically read this passage?</q><q label="Show the Greek">Walk me through the Greek of this passage.</q></followups>',
    );
    expect(blocks).toEqual([{ type: "prose", text: "Answer." }]);
    expect(actions).toEqual([
      {
        id: "followup-0",
        label: "How has my tradition read this?",
        prefill: "How has my tradition historically read this passage?",
        next: "",
      },
      {
        id: "followup-1",
        label: "Show the Greek",
        prefill: "Walk me through the Greek of this passage.",
        next: "",
      },
    ]);
  });

  it("a q with an empty body falls back to the label as prefill", () => {
    const { actions } = parseBlocks('<followups><q label="Quiz me"></q></followups>');
    expect(actions).toEqual([
      { id: "followup-0", label: "Quiz me", prefill: "Quiz me", next: "" },
    ]);
  });
});

describe("parseBlocks — streaming partials", () => {
  it("withholds a trailing unclosed tag and reports pending", () => {
    const { blocks, pending } = parseBlocks(
      'Intro prose.\n\n<points kind="objection"><point title="First">Half of the bo',
      { partial: true },
    );
    expect(blocks).toEqual([{ type: "prose", text: "Intro prose." }]);
    expect(pending).toBe(true);
  });

  it("withholds a partially typed opening tag", () => {
    const { blocks, pending } = parseBlocks("Prose so far <scrip", {
      partial: true,
    });
    expect(blocks).toEqual([{ type: "prose", text: "Prose so far" }]);
    expect(pending).toBe(true);
  });

  it("streams trailing prose live", () => {
    const { blocks, pending } = parseBlocks("Streaming prose still arrivi", {
      partial: true,
    });
    expect(blocks).toEqual([{ type: "prose", text: "Streaming prose still arrivi" }]);
    expect(pending).toBe(false);
  });

  it("completed tags parse even in partial mode", () => {
    const { blocks } = parseBlocks(
      '<scripture ref="John 1:1">In the beginning.</scripture>\n\nMore pro',
      { partial: true },
    );
    expect(blocks.map((b) => b.type)).toEqual(["scripture", "prose"]);
  });
});

describe("parseBlocks — malformed input degrades to prose", () => {
  it("an unclosed tag in final text becomes prose", () => {
    const { blocks, pending } = parseBlocks(
      '<scripture ref="John 1:1">Never closed.',
    );
    expect(blocks).toEqual([
      { type: "prose", text: '<scripture ref="John 1:1">Never closed.' },
    ]);
    expect(pending).toBe(false);
  });

  it("a structured tag with missing required parts becomes prose", () => {
    const { blocks } = parseBlocks("<scripture>No ref attribute.</scripture>");
    expect(blocks).toEqual([
      { type: "prose", text: "<scripture>No ref attribute.</scripture>" },
    ]);
  });

  it("unknown tags flow through as prose", () => {
    const { blocks } = parseBlocks("<sidebar>Not a real tag.</sidebar>");
    expect(blocks).toEqual([
      { type: "prose", text: "<sidebar>Not a real tag.</sidebar>" },
    ]);
  });

  it("an empty structured tag body yields nothing", () => {
    const { blocks } = parseBlocks('<lexicon></lexicon>');
    expect(blocks).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web && bunx vitest run src/components/chat/lib/parse-blocks.test.ts`
Expected: FAIL — cannot resolve `./parse-blocks`.

- [ ] **Step 3: Implement `apps/web/src/components/chat/lib/parse-blocks.ts`**

```ts
import type { Action, Block } from "./chat-state";

/**
 * Parser for the tagged streaming format the model emits (see the tag
 * vocabulary in packages/backend/convex/lib/prompts.ts). Untagged text
 * becomes prose blocks; each known tag maps 1:1 onto a Block variant;
 * <followups> maps to Action chips. Malformed or unknown tags degrade to
 * prose — this parser never throws on model output.
 */

export interface ParsedMessage {
  blocks: Block[];
  actions: Action[];
  /** True when partial text ends inside an unclosed tag (still streaming). */
  pending: boolean;
}

const TAG_NAMES = [
  "scripture",
  "history",
  "lexicon",
  "comparison",
  "points",
  "resources",
  "source",
  "article",
  "followups",
] as const;
type TagName = (typeof TAG_NAMES)[number];

const OPEN_TAG = new RegExp(`<(${TAG_NAMES.join("|")})(\\s[^>]*)?>`, "g");

function unescapeEntities(s: string): string {
  return s
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&amp;", "&");
}

function parseAttrs(raw: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw) return out;
  for (const m of raw.matchAll(/([\w-]+)="([^"]*)"/g)) {
    out[m[1]!] = unescapeEntities(m[2]!);
  }
  return out;
}

/** All <tag …>body</tag> and self-closing <tag … /> children of `inner`. */
function children(
  inner: string,
  tag: string,
): { attrs: Record<string, string>; body: string }[] {
  const re = new RegExp(
    `<${tag}(\\s[^>]*)?(?:/>|>([\\s\\S]*?)</${tag}>)`,
    "g",
  );
  const out: { attrs: Record<string, string>; body: string }[] = [];
  for (const m of inner.matchAll(re)) {
    out.push({ attrs: parseAttrs(m[1]), body: (m[2] ?? "").trim() });
  }
  return out;
}

/** Inner text of the first <tag>…</tag> child, unescaped. */
function tagText(inner: string, tag: string): string {
  const m = inner.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return m ? unescapeEntities(m[1]!.trim()) : "";
}

function pushProse(blocks: Block[], raw: string): void {
  for (const paragraph of raw.split(/\n{2,}/)) {
    const text = paragraph.trim();
    if (text) blocks.push({ type: "prose", text });
  }
}

const TIERS = ["introductory", "intermediate", "scholarly"] as const;
type Tier = (typeof TIERS)[number];

function toBlock(
  tag: Exclude<TagName, "followups">,
  attrs: Record<string, string>,
  inner: string,
): Block | null {
  switch (tag) {
    case "scripture": {
      const text = unescapeEntities(inner.trim());
      if (!attrs.ref || !text) return null;
      return { type: "scripture", reference: attrs.ref, text };
    }
    case "history": {
      const text = unescapeEntities(inner.trim());
      if (!attrs.heading || !text) return null;
      return { type: "history", heading: attrs.heading, text };
    }
    case "lexicon": {
      const entries = children(inner, "entry")
        .map((e) => ({
          term: e.attrs.term ?? "",
          translit: e.attrs.translit ?? "",
          gloss: e.attrs.gloss ?? "",
        }))
        .filter((e) => e.term && e.gloss);
      return entries.length > 0 ? { type: "lexicon", entries } : null;
    }
    case "comparison": {
      const columns = children(inner, "column")
        .map((c) => ({
          tradition: c.attrs.tradition ?? "",
          position: tagText(c.body, "position"),
          texts: tagText(c.body, "texts"),
          theologians: tagText(c.body, "theologians"),
        }))
        .filter((c) => c.tradition && c.position);
      return columns.length > 0 ? { type: "comparison", columns } : null;
    }
    case "points": {
      const kind = attrs.kind === "response" ? "response" : "objection";
      const items = children(inner, "point")
        .map((p) => ({
          title: p.attrs.title ?? "",
          body: unescapeEntities(p.body),
          ...(p.attrs.weight ? { weight: p.attrs.weight } : {}),
        }))
        .filter((i) => i.title && i.body);
      return items.length > 0 ? { type: "points", kind, items } : null;
    }
    case "resources": {
      const items = children(inner, "item")
        .map((it) => ({
          title: it.attrs.title ?? "",
          author: it.attrs.author ?? "",
          tier: (TIERS as readonly string[]).includes(it.attrs.tier ?? "")
            ? (it.attrs.tier as Tier)
            : "introductory",
          note: unescapeEntities(it.body),
        }))
        .filter((i) => i.title);
      return items.length > 0 ? { type: "resources", items } : null;
    }
    case "source": {
      const excerpt = unescapeEntities(inner.trim());
      if (!attrs.work || !excerpt) return null;
      return {
        type: "source",
        work: attrs.work,
        author: attrs.author ?? "",
        citation: attrs.citation ?? "",
        excerpt,
      };
    }
    case "article": {
      const body = unescapeEntities(inner.trim());
      if (!attrs.label || !body) return null;
      const proofs = attrs.proofs
        ? attrs.proofs.split(";").map((p) => p.trim()).filter(Boolean)
        : undefined;
      return {
        type: "article",
        source: attrs.source ?? "",
        label: attrs.label,
        body,
        ...(proofs && proofs.length > 0 ? { proofs } : {}),
      };
    }
  }
}

export function parseBlocks(
  text: string,
  opts?: { partial?: boolean },
): ParsedMessage {
  const blocks: Block[] = [];
  const actions: Action[] = [];
  let pending = false;
  let cursor = 0;

  OPEN_TAG.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = OPEN_TAG.exec(text)) !== null) {
    const tag = match[1] as TagName;
    const openEnd = match.index + match[0].length;
    const closeTag = `</${tag}>`;
    const closeIndex = text.indexOf(closeTag, openEnd);

    if (closeIndex === -1) {
      if (opts?.partial) {
        // Unclosed tag while streaming: emit the prose before it, withhold the rest.
        pushProse(blocks, text.slice(cursor, match.index));
        cursor = text.length;
        pending = true;
        break;
      }
      // Final text with an unclosed tag: leave it for the prose tail (degrade).
      continue;
    }

    pushProse(blocks, text.slice(cursor, match.index));
    const inner = text.slice(openEnd, closeIndex);

    if (tag === "followups") {
      for (const [i, q] of children(inner, "q").entries()) {
        const label = q.attrs.label ?? "";
        const prefill = unescapeEntities(q.body) || label;
        if (!prefill) continue;
        actions.push({
          id: `followup-${i}`,
          label: label || prefill,
          prefill,
          next: "",
        });
      }
    } else {
      const block = toBlock(tag, parseAttrs(match[2]), inner);
      if (block) {
        blocks.push(block);
      } else if (inner.trim()) {
        // Structurally invalid tag with content: surface its raw text as
        // prose. An empty invalid tag (e.g. <lexicon></lexicon>) is dropped.
        pushProse(blocks, text.slice(match.index, closeIndex + closeTag.length));
      }
    }
    cursor = closeIndex + closeTag.length;
    OPEN_TAG.lastIndex = cursor;
  }

  if (!pending) {
    let tail = text.slice(cursor);
    if (opts?.partial) {
      // A partially typed opening tag at the very end — hold it back.
      const partialOpen = tail.match(/<[a-z][^>]*$/i);
      if (partialOpen) {
        tail = tail.slice(0, partialOpen.index);
        pending = true;
      }
    }
    pushProse(blocks, tail);
  }

  return { blocks, actions, pending };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && bunx vitest run src/components/chat/lib/parse-blocks.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Run the full web suite**

Run: `cd apps/web && bun run test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(web): incremental parser for tagged AI output"
```

---

### Task 6: Live thread UI and chat-app merge

**Files:**
- Create: `apps/web/src/components/chat/live-thread.tsx`
- Modify: `apps/web/src/components/chat/chat-thread.tsx` (add `isStreaming` prop)
- Modify: `apps/web/src/components/chat/chat-app.tsx` (merge live + mock, live start path)

**Interfaces:**
- Consumes:
  - `api.chat.createConversation` / `sendMessage` / `listConversations` / `listThreadMessages` (Task 4)
  - `parseBlocks` (Task 5)
  - `useUIMessages` + `type UIMessage` from `@convex-dev/agent/react`; `useQuery`, `useMutation` from `convex/react`
- Produces:
  - `interface LiveConversation extends Conversation { threadId: string; convexId: Id<"conversations"> }` (exported from `live-thread.tsx`)
  - `<LiveThread conversation={LiveConversation} />` — self-contained: fetches/streams messages, sends messages, renders `ChatThread`

- [ ] **Step 1: Extend `ChatThread` with an `isStreaming` prop**

In `apps/web/src/components/chat/chat-thread.tsx`:

```tsx
export default function ChatThread({
  conversation,
  isReplying,
  isStreaming = false,
  onSend,
  onAction,
}: {
  conversation: Conversation;
  isReplying: boolean;
  isStreaming?: boolean;
  onSend: (text: string) => void;
  onAction: (action: Action) => void;
}) {
```

- The `showActions` condition gains `&& !isStreaming`:

```tsx
const showActions =
  exchange.assistant === lastMessage &&
  !isReplying &&
  !isStreaming &&
  (exchange.assistant?.actions?.length ?? 0) > 0;
```

- The composer disables during streaming too:

```tsx
<ChatComposer
  onSend={onSend}
  disabled={isReplying || isStreaming}
  …
```

The typing dots stay tied to `isReplying` only (dots before the first delta; once blocks stream in, the growing reply itself is the indicator).

- [ ] **Step 2: Create `apps/web/src/components/chat/live-thread.tsx`**

```tsx
"use client";

import { useUIMessages, type UIMessage } from "@convex-dev/agent/react";
import { api } from "@theologia/backend/convex/_generated/api";
import type { Id } from "@theologia/backend/convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { toast } from "sonner";

import ChatThread from "./chat-thread";
import {
  blocksToText,
  type Action,
  type Conversation,
  type Message,
} from "./lib/chat-state";
import { parseBlocks } from "./lib/parse-blocks";

/** A Convex-backed conversation: the mock Conversation shape plus its ids. */
export interface LiveConversation extends Conversation {
  threadId: string;
  convexId: Id<"conversations">;
}

function toMessage(m: UIMessage): Message | null {
  if (m.role === "user") {
    return { id: m.key, role: "user", content: m.text };
  }
  if (m.role !== "assistant") return null;
  const parsed = parseBlocks(m.text, { partial: m.status === "streaming" });
  if (parsed.blocks.length === 0) return null; // nothing renderable yet
  return {
    id: m.key,
    role: "assistant",
    content: blocksToText(parsed.blocks),
    blocks: parsed.blocks,
    actions: parsed.actions.length > 0 ? parsed.actions : undefined,
  };
}

export default function LiveThread({
  conversation,
}: {
  conversation: LiveConversation;
}) {
  const { results } = useUIMessages(
    api.chat.listThreadMessages,
    { threadId: conversation.threadId },
    { initialNumItems: 50, stream: true },
  );
  const sendMessage = useMutation(api.chat.sendMessage);

  const uiMessages = results ?? [];
  const messages = uiMessages
    .map(toMessage)
    .filter((m): m is Message => m !== null);

  const last = uiMessages.at(-1);
  const isStreaming = last?.role === "assistant" && last.status === "streaming";
  const isReplying = messages.at(-1)?.role === "user";

  function send(text: string) {
    if (isReplying || isStreaming) return;
    sendMessage({ conversationId: conversation.convexId, text }).catch(() => {
      toast.error("Could not send the message. Please try again.");
    });
  }

  return (
    <ChatThread
      conversation={{ ...conversation, messages }}
      isReplying={isReplying}
      isStreaming={isStreaming}
      onSend={send}
      onAction={(action: Action) => send(action.prefill)}
    />
  );
}
```

Implementation notes:
- `useUIMessages` and the `UIMessage` type come from `@convex-dev/agent/react`; if the installed version names the key field differently (`m.key` vs `m.id`), use whatever the type exposes — it only feeds the React key.
- The empty-assistant filter (`parsed.blocks.length === 0 → null`) keeps `groupIntoExchanges`'s strict user/assistant pairing intact while dots show before the first delta.

- [ ] **Step 3: Merge live conversations into `chat-app.tsx`**

Modify `apps/web/src/components/chat/chat-app.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";

import { api } from "@theologia/backend/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";

import ChatEmpty from "./chat-empty";
import ChatSidebar from "./chat-sidebar";
import ChatThread from "./chat-thread";
import ChatUsageMeter from "./chat-usage-meter";
import LiveThread, { type LiveConversation } from "./live-thread";
import {
  appendMessage,
  withReply,
  type Action,
  type Conversation,
  type ConversationSetup,
  type ModeId,
} from "./lib/chat-state";
import { SEED_CONVERSATIONS } from "./lib/mock-chat";
import { getScript } from "./lib/scripts";
import styles from "./chat-app.module.css";

const REPLY_DELAY_MS = 900;

type ReplyOpts = { actionNext?: string; isFirst?: boolean };

export default function ChatApp() {
  // Mock seed conversations — untouched until live output is verified.
  const [mockConversations, setMockConversations] =
    useState<Conversation[]>(SEED_CONVERSATIONS);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isReplying, setIsReplying] = useState(false);
  const replyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const liveRows = useQuery(api.chat.listConversations);
  const createConversation = useMutation(api.chat.createConversation);

  useEffect(() => {
    return () => {
      if (replyTimer.current) clearTimeout(replyTimer.current);
    };
  }, []);

  const liveConversations: LiveConversation[] = (liveRows ?? []).map((row) => ({
    id: row._id,
    convexId: row._id,
    threadId: row.threadId,
    title: row.title,
    mode: row.mode,
    framework: row.framework,
    subTradition: row.subTradition,
    opposing: row.opposing,
    traditions: row.traditions,
    document: row.document,
    purpose: row.purpose,
    collection: row.collection,
    messages: [],
  }));

  const sidebarConversations: Conversation[] = [
    ...liveConversations,
    ...mockConversations,
  ];

  const activeLive =
    liveConversations.find((c) => c.id === activeId) ?? null;
  const activeMock =
    mockConversations.find((c) => c.id === activeId) ?? null;

  function updateMockConversation(
    id: string,
    update: (conversation: Conversation) => Conversation,
  ) {
    setMockConversations((prev) =>
      prev.map((c) => (c.id === id ? update(c) : c)),
    );
  }

  // Scripted assistant response — mock threads only.
  function scheduleReply(id: string, opts: ReplyOpts) {
    setIsReplying(true);
    replyTimer.current = setTimeout(() => {
      updateMockConversation(id, (c) => withReply(c, getScript(c.mode), opts));
      setIsReplying(false);
    }, REPLY_DELAY_MS);
  }

  function handleNewChat() {
    setActiveId(null);
  }

  async function handleStart(input: {
    mode: ModeId;
    setup: ConversationSetup;
    firstMessage: string;
  }) {
    try {
      const conversationId = await createConversation(input);
      setActiveId(conversationId);
    } catch {
      toast.error("Could not start the study. Please try again.");
    }
  }

  function handleMockSend(text: string) {
    if (!activeMock || isReplying) return;
    const id = activeMock.id;
    updateMockConversation(id, (c) =>
      appendMessage(c, { role: "user", content: text }),
    );
    scheduleReply(id, {});
  }

  function handleMockAction(action: Action) {
    if (!activeMock || isReplying) return;
    const id = activeMock.id;
    updateMockConversation(id, (c) =>
      appendMessage(c, { role: "user", content: action.prefill }),
    );
    scheduleReply(id, { actionNext: action.next });
  }

  return (
    <div className={styles.root}>
      <div className={styles.shell}>
        <ChatSidebar
          conversations={sidebarConversations}
          activeId={activeId}
          onSelect={setActiveId}
          onNewChat={handleNewChat}
        />
        <main className={styles.main}>
          <div className={styles.fresco} aria-hidden />
          <div className={styles.overlay} aria-hidden />
          <div className={styles.grain} aria-hidden />
          <div className={styles.content}>
            {activeLive ? (
              <LiveThread key={activeLive.id} conversation={activeLive} />
            ) : activeMock ? (
              <ChatThread
                conversation={activeMock}
                isReplying={isReplying}
                onSend={handleMockSend}
                onAction={handleMockAction}
              />
            ) : (
              <ChatEmpty onStart={handleStart} />
            )}
          </div>
          <ChatUsageMeter />
        </main>
      </div>
    </div>
  );
}
```

Notes:
- `handleStart` becoming async is compatible with `ChatEmpty`'s `onStart` prop (the return value is ignored); verify `ChatEmpty`'s prop type is `(input) => void` and, if it is, the `async` function still satisfies it.
- `key={activeLive.id}` on `LiveThread` resets the hook state when switching conversations.
- `mode: row.mode` — the schema's `vMode` union means the row type already matches `ModeId`; no cast needed.

- [ ] **Step 4: Typecheck and run the web suite**

Run: `cd apps/web && bunx tsc --noEmit && bun run test`
Expected: clean typecheck (except any pre-existing unrelated errors — report those), tests PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(web): live Convex-backed chat threads alongside mock seeds"
```

---

### Task 7: End-to-end manual verification

No new files — this task verifies the whole slice and produces a report for Dylan. **Do not remove or modify any mock.**

- [ ] **Step 1: Start both dev servers**

Run (separate background processes): `bun dev:server` (Convex) and `bun dev:web` (Next on port 3001).
Expected: both boot; Convex deploys `chat` functions.

- [ ] **Step 2: Sign in and exercise every mode**

Open `http://localhost:3001/chat`, sign in (create an account if needed). For each mode, start a new study with the listed setup + first message, and record: did it stream, which blocks appeared, did followup chips appear and work, does formatting match the mock exemplars.

| Mode | Setup | First message |
|---|---|---|
| Q&A | Reformed · Presbyterian | What does Romans 9 mean for election? |
| Devil's Advocate | Reformed vs Arminian | Test unconditional election against Romans 9. |
| Comparison | Reformed · Lutheran · Roman Catholic | What happens at the Lord's Supper? |
| Debate Prep | Reformed vs Baptist | Infant baptism is biblical. |
| Catechism | Westminster Standards | Walk me through the opening question. |
| Resources | Baptist · Sermon prep | The doctrine of the atonement |
| Library | Ante-Nicene Fathers | What did the early church believe about the Eucharist? |
| Scripture Study | Lutheran | Romans 9:14–24 |

Checks per conversation:
1. Reply streams (prose appears progressively; structured blocks pop in complete).
2. Mode-appropriate blocks render via the existing `MessageBlocks` styling.
3. Structured sections appear only when warranted (not every reply stuffed with every tag).
4. Followup chips appear at least sometimes; clicking one sends its full question and gets a coherent answer.
5. A second typed message continues the conversation with context retained.

- [ ] **Step 3: Verify the mock seeds are intact**

Click each seeded mock conversation in the sidebar; confirm scripted replies and action chips still work exactly as before, and the new live conversations coexist above them.

- [ ] **Step 4: Verify auth boundaries**

`bunx convex run chat:listConversations '{}'` from the CLI returns `[]` (no identity), and a signed-out browser tab on `/chat` shows the sign-in card (existing behavior).

- [ ] **Step 5: Report**

Write up results for Dylan: what worked, per-mode formatting quality vs the mocks, any prompt adjustments recommended, and any deviations taken during implementation. **Do not remove mocks** — that is a separate slice after Dylan verifies.

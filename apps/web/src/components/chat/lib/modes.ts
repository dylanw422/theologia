import type { Conversation } from "./chat-state";
import { getFramework, getSubTradition } from "./frameworks";
import {
  COLLECTIONS,
  DOCUMENTS,
  MODE_MIN_PLAN,
  MODE_SETUP,
  PURPOSES,
  type ConversationSetup,
  type ModeId,
  type SetupKind,
} from "@theologia/backend/convex/lib/studyData";
import { PLANS } from "@theologia/backend/convex/lib/plans";

export {
  DOCUMENTS,
  COLLECTIONS,
  PURPOSES,
  MODE_MIN_PLAN,
  isModeAllowedForPlan,
  isSetupValid,
  type SetupKind,
} from "@theologia/backend/convex/lib/studyData";

/** Human label for the plan a mode requires, e.g. "Ministry". */
export function modeMinPlanLabel(id: ModeId): string {
  return PLANS[MODE_MIN_PLAN[id]].label;
}

export interface Mode {
  id: ModeId;
  label: string;
  heading: { pre: string; em: string; post: string };
  lede: string;
  placeholder: string;
  setup: SetupKind;
  samplePrompts: { topic: string; prompt: string }[];
  useCases: string[];
}

/**
 * The seven study modes — GOAL.md's features rendered as one chat surface,
 * trimmed of overlap (debate-prep merged into devils-advocate, resources
 * folded into qa). Church History Surfacing is not a mode; it appears as
 * `history` blocks woven into answers across modes.
 */
export const MODES: Mode[] = [
  {
    id: "qa",
    label: "Q&A",
    heading: { pre: "What will you ", em: "study", post: " today?" },
    lede: "Ask anything. Theologia answers from within your tradition — its confessions, its theologians, its history.",
    placeholder: "Ask a question…",
    setup: MODE_SETUP.qa,
    samplePrompts: [
      { topic: "Exegesis", prompt: "What does Romans 9 mean for election?" },
      { topic: "Sacraments", prompt: "Does baptism save?" },
      {
        topic: "Soteriology",
        prompt: "How do faith and works relate in salvation?",
      },
    ],
    useCases: [
      "Quick doctrine checks — “what does my church teach about this?”",
      "Working through a hard passage or objection inside your own tradition",
      "Asking what to read on a topic",
    ],
  },
  {
    id: "devils-advocate",
    label: "Devil's Advocate",
    heading: { pre: "Face the ", em: "strongest", post: " objections." },
    lede: "Lock in your tradition, choose a rival, and hear its best case — argued seriously, never as a strawman — then drill your answers until they hold.",
    placeholder: "Name the doctrine or passage to put under pressure…",
    setup: MODE_SETUP["devils-advocate"],
    samplePrompts: [
      {
        topic: "Election",
        prompt: "Test unconditional election against Romans 9.",
      },
      {
        topic: "Perseverance",
        prompt: "Challenge eternal security from Hebrews 6.",
      },
      {
        topic: "Sacraments",
        prompt: "Press my view of the Lord's Supper on John 6.",
      },
    ],
    useCases: [
      "Stress-testing a doctrine against a rival tradition's best arguments",
      "Preparing to defend a thesis — ranked objections, then drilling your answers",
    ],
  },
  {
    id: "comparison",
    label: "Comparison",
    heading: { pre: "Set the traditions ", em: "side by side", post: "." },
    lede: "Choose two to four traditions and see each position, its texts, and its theologians — none privileged, all serious.",
    placeholder: "Enter a passage, doctrine, or question to compare…",
    setup: MODE_SETUP.comparison,
    samplePrompts: [
      {
        topic: "Soteriology",
        prompt: "How do faith and works relate in salvation?",
      },
      { topic: "Eucharist", prompt: "What happens at the Lord's Supper?" },
      { topic: "Baptism", prompt: "Who should be baptized, and why?" },
    ],
    useCases: [
      "Seeing where the traditions actually divide on a doctrine",
      "Preparing to teach a fair survey of views",
    ],
  },
  {
    id: "catechism",
    label: "Catechism",
    heading: { pre: "Study the ", em: "confessions", post: " with a tutor." },
    lede: "Read the church's confessional documents with explanation, cross-references, and a tutor who quizzes you back.",
    placeholder: "Ask about the document, or say where to begin…",
    setup: MODE_SETUP.catechism,
    samplePrompts: [
      { topic: "Start", prompt: "Walk me through the opening question." },
      {
        topic: "Context",
        prompt: "Why was this document written, and against what?",
      },
      { topic: "Quiz", prompt: "Quiz me on what I have read so far." },
    ],
    useCases: [
      "Working through a confession or catechism with a tutor",
      "Being quizzed on the articles you have read",
    ],
  },
  {
    id: "library",
    label: "Library",
    heading: { pre: "Search the ", em: "Fathers", post: "." },
    lede: "The patristic and primary-source library — councils, confessions, and the Fathers, searchable and explained in plain language.",
    placeholder: "Search the primary sources…",
    setup: MODE_SETUP.library,
    samplePrompts: [
      {
        topic: "Eucharist",
        prompt: "What did the early church believe about the Eucharist?",
      },
      {
        topic: "Baptism",
        prompt: "Show me what the ante-Nicene Fathers wrote about baptism.",
      },
      {
        topic: "Trinity",
        prompt: "How did the Fathers speak of the Son before Nicaea?",
      },
    ],
    useCases: [
      "Finding what the Fathers and councils actually said",
      "Tracing a doctrine through the primary sources",
    ],
  },
  {
    id: "scripture-study",
    label: "Scripture Study",
    heading: { pre: "Go ", em: "deep", post: " in the text." },
    lede: "Bring a passage. Receive original-language notes, historical context, your tradition's reading, and the Fathers on the text.",
    placeholder: "Enter a passage — e.g., Romans 9:14–24…",
    setup: MODE_SETUP["scripture-study"],
    samplePrompts: [
      { topic: "Peter", prompt: "1 Peter 3:18–22" },
      { topic: "Romans", prompt: "Romans 9:14–24" },
      { topic: "John", prompt: "John 6:35–58" },
    ],
    useCases: [
      "Deep study of one passage — language, context, interpreters",
      "Understanding how your tradition reads a disputed text",
    ],
  },
  {
    id: "sermon-prep",
    label: "Sermon Prep",
    heading: { pre: "Prepare to ", em: "preach", post: " the text." },
    lede: "Bring Sunday's passage or theme. Exegesis, historical context, your tradition's reading, and the church's voice on the text — the study behind the sermon.",
    placeholder: "Enter your sermon passage or theme…",
    setup: MODE_SETUP["sermon-prep"],
    samplePrompts: [
      { topic: "Passage", prompt: "I'm preaching John 6:35–58 this Sunday." },
      { topic: "Theme", prompt: "A sermon on assurance from Romans 8." },
      { topic: "Series", prompt: "Beginning a series on the Lord's Prayer." },
    ],
    useCases: [
      "You're preaching soon and need the study behind the text",
      "Gathering exegesis, illustrations, and application angles",
      "Checking your reading against the tradition before you preach",
    ],
  },
];

/** Modes removed from the picker but still present on old conversations. */
const LEGACY_MODE_ALIASES: Partial<Record<ModeId, ModeId>> = {
  "debate-prep": "devils-advocate",
  resources: "qa",
};

export function getMode(id: ModeId): Mode {
  const mode = MODES.find((m) => m.id === id);
  if (mode) return mode;
  const alias = LEGACY_MODE_ALIASES[id];
  if (alias) return getMode(alias);
  throw new Error(`Unknown mode: ${id}`);
}

function frameworkLabel(id?: string): string {
  return id ? (getFramework(id)?.label ?? "") : "";
}

/**
 * Human label for a conversation's locked setup — shown in the thread header,
 * composer lock chip, and sidebar markers.
 */
export function describeSetup(
  c: Pick<Conversation, "mode"> & ConversationSetup,
): string {
  switch (getMode(c.mode).setup) {
    case "tradition": {
      const sub = c.framework && c.subTradition
        ? getSubTradition(c.framework, c.subTradition)?.label
        : undefined;
      const base = frameworkLabel(c.framework);
      return sub ? `${base} · ${sub}` : base;
    }
    case "versus":
      return `${frameworkLabel(c.framework)} vs ${frameworkLabel(c.opposing)}`;
    case "multi-tradition":
      return (c.traditions ?? []).map(frameworkLabel).join(" · ");
    case "document":
      return DOCUMENTS.find((d) => d.id === c.document)?.label ?? "";
    case "collection":
      return COLLECTIONS.find((x) => x.id === c.collection)?.label ?? "";
    case "tradition-purpose": {
      const purpose = PURPOSES.find((p) => p.id === c.purpose)?.label;
      const base = frameworkLabel(c.framework);
      return purpose ? `${base} · ${purpose}` : base;
    }
  }
}

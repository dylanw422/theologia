import type { Conversation } from "./chat-state";
import { getFramework, getSubTradition } from "./frameworks";
import {
  COLLECTIONS,
  DOCUMENTS,
  MODE_SETUP,
  PURPOSES,
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

export interface Mode {
  id: ModeId;
  label: string;
  heading: { pre: string; em: string; post: string };
  lede: string;
  placeholder: string;
  setup: SetupKind;
  samplePrompts: { topic: string; prompt: string }[];
}

/**
 * The eight study modes — GOAL.md's features rendered as one chat surface.
 * Church History Surfacing is not a mode; it appears as `history` blocks
 * woven into answers across modes.
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
  },
  {
    id: "devils-advocate",
    label: "Devil's Advocate",
    heading: { pre: "Face the ", em: "strongest", post: " objections." },
    lede: "Lock in your tradition, choose a rival, and hear its best case — argued seriously, never as a strawman.",
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
  },
  {
    id: "debate-prep",
    label: "Debate Prep",
    heading: { pre: "Defend your ", em: "thesis", post: "." },
    lede: "State what you are defending. Theologia ranks the objections you will face and drills you until you can answer them.",
    placeholder: "State the thesis you are defending…",
    setup: MODE_SETUP["debate-prep"],
    samplePrompts: [
      { topic: "Ordo salutis", prompt: "Regeneration precedes faith." },
      {
        topic: "Justification",
        prompt: "Justification is by faith alone.",
      },
      {
        topic: "Baptism",
        prompt: "Baptism is for professing believers only.",
      },
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
  },
  {
    id: "resources",
    label: "Resources",
    heading: { pre: "Build your ", em: "shelf", post: "." },
    lede: "Tradition-aware recommendations — primary sources first, tiered from introductory to scholarly, matched to your purpose.",
    placeholder: "Name the topic you are studying…",
    setup: MODE_SETUP.resources,
    samplePrompts: [
      { topic: "Covenant", prompt: "Covenant theology" },
      { topic: "Commentary", prompt: "A commentary on Romans" },
      { topic: "Doctrine", prompt: "The doctrine of the atonement" },
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
  },
];

export function getMode(id: ModeId): Mode {
  const mode = MODES.find((m) => m.id === id);
  if (!mode) throw new Error(`Unknown mode: ${id}`);
  return mode;
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

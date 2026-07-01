import type { Conversation, ConversationSetup, ModeId } from "./chat-state";
import { getFramework, getSubTradition } from "./frameworks";

/** Which setup controls the composer shows for a mode. */
export type SetupKind =
  | "tradition"
  | "versus"
  | "multi-tradition"
  | "document"
  | "tradition-purpose"
  | "collection";

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
    setup: "tradition",
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
    setup: "versus",
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
    setup: "multi-tradition",
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
    setup: "versus",
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
    setup: "document",
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
    setup: "tradition-purpose",
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
    setup: "collection",
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
    setup: "tradition",
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

/** The 12 confessional documents from GOAL.md's Catechism & Confession Tutor. */
export const DOCUMENTS = [
  { id: "westminster", label: "Westminster Standards" },
  { id: "heidelberg", label: "Heidelberg Catechism" },
  { id: "belgic", label: "Belgic Confession" },
  { id: "dort", label: "Canons of Dort" },
  { id: "london-1689", label: "1689 London Baptist Confession" },
  { id: "augsburg", label: "Augsburg Confession" },
  { id: "luthers-catechisms", label: "Luther's Catechisms" },
  { id: "ecumenical-creeds", label: "The Ecumenical Creeds" },
  { id: "chalcedon", label: "Definition of Chalcedon" },
  { id: "trent", label: "Council of Trent" },
  { id: "baltimore", label: "Baltimore Catechism" },
  { id: "dordrecht", label: "Dordrecht Confession" },
];

/** Library eras/collections from GOAL.md's Patristic & Primary Source Library. */
export const COLLECTIONS = [
  { id: "apostolic-fathers", label: "Apostolic Fathers" },
  { id: "ante-nicene", label: "Ante-Nicene Fathers" },
  { id: "nicene-post-nicene", label: "Nicene & Post-Nicene Fathers" },
  { id: "medieval", label: "Medieval Theologians" },
  { id: "reformation", label: "Reformation Sources" },
  { id: "councils", label: "Council Documents" },
];

export const PURPOSES = [
  { id: "debate-prep", label: "Debate prep" },
  { id: "sermon-prep", label: "Sermon prep" },
  { id: "personal-study", label: "Personal study" },
  { id: "academic-research", label: "Academic research" },
];

/** Whether the new-study setup is complete enough to send the first message. */
export function isSetupValid(mode: ModeId, setup: ConversationSetup): boolean {
  switch (getMode(mode).setup) {
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

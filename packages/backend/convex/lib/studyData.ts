/**
 * Shared static study data — the single source of truth for traditions,
 * documents, collections, and purposes. The Convex prompt builders and the
 * web chat UI both import from here.
 */

import { planMeetsMinimum, type PlanId } from "./plans";

export type ModeId =
  | "qa"
  | "devils-advocate"
  | "comparison"
  | "catechism"
  | "library"
  | "scripture-study"
  | "sermon-prep"
  // Legacy — no longer offered in the UI; kept so existing conversations
  // remain valid. debate-prep merged into devils-advocate; resources
  // folded into qa.
  | "debate-prep"
  | "resources";

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

function sub(id: string, label: string): SubTradition {
  return { id, label };
}

/**
 * The theological traditions Theologia supports at launch, from docs/GOAL.md,
 * ordered alphabetically by label. Labels use the short display form
 * ("Reformed", not "Reformed / Calvinist") — this audience knows the
 * pairings. Sub-traditions are the optional refinements offered when a user
 * starts a new conversation.
 */
export const FRAMEWORKS: Framework[] = [
  {
    id: "anabaptist-mennonite",
    label: "Anabaptist",
    subTraditions: [
      sub("conservative-mennonite", "Conservative Mennonite"),
      sub("amish-adjacent", "Amish-adjacent"),
      sub("modern-anabaptist", "Modern Anabaptist"),
    ],
  },
  {
    id: "anglican-episcopal",
    label: "Anglican",
    subTraditions: [
      sub("high-church", "High Church"),
      sub("low-church", "Low Church"),
      sub("broad-church", "Broad Church"),
    ],
  },
  {
    id: "arminian-wesleyan",
    label: "Arminian",
    subTraditions: [
      sub("classical-arminian", "Classical Arminian"),
      sub("wesleyan-holiness", "Wesleyan-Holiness"),
      sub("open-theism", "Open Theism (flagged)"),
    ],
  },
  {
    id: "baptist",
    label: "Baptist",
    subTraditions: [
      sub("particular-baptist", "Particular Baptist (Reformed)"),
      sub("general-baptist", "General Baptist"),
      sub("southern-baptist", "Southern Baptist"),
    ],
  },
  {
    id: "covenant-theology",
    label: "Covenant Theology (non-Reformed)",
    subTraditions: [sub("new-covenant-theology", "New Covenant Theology")],
  },
  {
    id: "dispensationalist-evangelical",
    label: "Dispensationalist Evangelical",
    subTraditions: [
      sub("classic-dispensationalism", "Classic Dispensationalism"),
      sub("progressive-dispensationalism", "Progressive Dispensationalism"),
    ],
  },
  {
    id: "eastern-orthodox",
    label: "Eastern Orthodox",
    subTraditions: [
      sub("greek-orthodox", "Greek Orthodox"),
      sub("russian-orthodox", "Russian Orthodox"),
      sub("antiochian", "Antiochian"),
    ],
  },
  {
    id: "lutheran",
    label: "Lutheran",
    subTraditions: [
      sub("confessional-lutheran", "Confessional Lutheran (LCMS)"),
      sub("evangelical-lutheran", "Evangelical Lutheran (ELCA-leaning)"),
    ],
  },
  {
    id: "oneness-pentecostal",
    label: "Oneness Pentecostal",
    subTraditions: [
      sub("upci-aligned", "UPCI-aligned"),
      sub("apostolic", "Apostolic"),
    ],
  },
  {
    id: "pentecostal-charismatic",
    label: "Pentecostal",
    subTraditions: [
      sub("trinitarian-pentecostal", "Trinitarian Pentecostal"),
      sub("charismatic-evangelical", "Charismatic Evangelical"),
    ],
  },
  {
    id: "reformed",
    label: "Reformed",
    subTraditions: [
      sub("presbyterian", "Presbyterian"),
      sub("dutch-reformed", "Dutch Reformed"),
      sub("reformed-baptist", "Reformed Baptist"),
      sub("continental-reformed", "Continental Reformed"),
    ],
  },
  {
    id: "roman-catholic",
    label: "Roman Catholic",
    subTraditions: [
      sub("pre-vatican-ii", "Pre-Vatican II Traditionalist"),
      sub("post-vatican-ii", "Post-Vatican II"),
    ],
  },
];

export function getFramework(id: string): Framework | undefined {
  return FRAMEWORKS.find((f) => f.id === id);
}

export function getSubTradition(
  frameworkId: string,
  subId: string,
): SubTradition | undefined {
  return getFramework(frameworkId)?.subTraditions.find((s) => s.id === subId);
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

export const MODE_SETUP: Record<ModeId, SetupKind> = {
  qa: "tradition",
  "devils-advocate": "versus",
  comparison: "multi-tradition",
  catechism: "document",
  library: "collection",
  "scripture-study": "tradition",
  "sermon-prep": "tradition",
  // Legacy modes (see ModeId).
  "debate-prep": "versus",
  resources: "tradition-purpose",
};

/** Minimum plan (per the pricing card on the marketing page) each mode
 * requires. Legacy modes inherit the plan of the mode they were merged
 * into, since a still-open old conversation shouldn't newly lock. */
export const MODE_MIN_PLAN: Record<ModeId, PlanId> = {
  qa: "free",
  "devils-advocate": "scholar",
  comparison: "scholar",
  catechism: "ministry",
  library: "ministry",
  "scripture-study": "ministry",
  "sermon-prep": "ministry",
  // Legacy modes (see ModeId).
  "debate-prep": "scholar",
  resources: "free",
};

export function isModeAllowedForPlan(mode: ModeId, planId: PlanId): boolean {
  return planMeetsMinimum(planId, MODE_MIN_PLAN[mode]);
}

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

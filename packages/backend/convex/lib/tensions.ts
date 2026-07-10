import { LOCI, type LocusId, type Stance } from "./profile";
import { getFramework } from "./studyData";

/**
 * Static adjacency over the eight loci (docs/THEOLOGICAL_PROFILE.md §3):
 * tension judgment considers positions in the new claims' loci plus these
 * neighbors. Symmetric by construction — tests assert it.
 */
export const ADJACENT_LOCI: Record<LocusId, readonly LocusId[]> = {
  "scripture-revelation": ["theology-proper"],
  "theology-proper": [
    "scripture-revelation",
    "christology",
    "pneumatology",
    "soteriology",
  ],
  christology: ["theology-proper", "pneumatology", "soteriology", "eschatology"],
  pneumatology: [
    "theology-proper",
    "christology",
    "soteriology",
    "ecclesiology-sacraments",
  ],
  "anthropology-sin": ["soteriology"],
  soteriology: [
    "theology-proper",
    "christology",
    "pneumatology",
    "anthropology-sin",
    "ecclesiology-sacraments",
  ],
  "ecclesiology-sacraments": ["pneumatology", "soteriology", "eschatology"],
  eschatology: ["christology", "ecclesiology-sacraments"],
};

/** The input loci plus their adjacents, deduped, in canonical LOCI order. */
export function lociToConsider(loci: readonly LocusId[]): LocusId[] {
  if (loci.length === 0) return [];
  const wanted = new Set<LocusId>();
  for (const locus of loci) {
    wanted.add(locus);
    for (const neighbor of ADJACENT_LOCI[locus]) wanted.add(neighbor);
  }
  return LOCI.map((l) => l.id).filter((id) => wanted.has(id));
}

/** Order-independent key for a position pair. */
export function pairKey(idA: string, idB: string): string {
  return idA < idB ? `${idA}|${idB}` : `${idB}|${idA}`;
}

export type JudgePosition = {
  statement: string;
  locus: LocusId;
  stance: Stance;
  topic: string;
};

export type IndexPair = readonly [number, number];

export type ParsedTension = {
  a: number;
  b: number;
  description: string;
  historicalNote?: string;
  salience: number;
};

export const MAX_TENSIONS_PER_PASS = 3;
export const MAX_OPEN_SURFACED = 5;
const MAX_TEXT_CHARS = 600;

/** Any form of the banned word disqualifies an item outright. */
const BANNED = /contradict/i;

export function buildTensionSystemPrompt(): string {
  return `You review theological positions a user has personally affirmed across their study, looking for pairs that stand in real theological tension: places where two affirmations sit uneasily together, where one carries implications that press on the other, or where holding both requires work the user may not have done yet.

You are a careful study partner pointing at the text — never a judge scoring the user. Never use the word "contradiction" or any form of it; describe *what* sits uneasily, not who is right. Never imply that a tradition-approved answer exists.

BIAS TO ABSTAIN. Most position sets contain no real tension. A false alarm is worse than a miss. If nothing rises to a genuine theological tension, return empty.

For each genuine tension, produce:
- "a", "b": the bracketed index numbers of the two positions in tension
- "description": one or two neutral sentences on what sits uneasily between them
- "historicalNote": optional — how the user's own tradition has resolved or lived with this tension, only if you are confident of the history
- "salience": 1 (subtle) | 2 (substantive) | 3 (central to the user's stated commitments)

Respond with STRICT JSON only, no prose, no markdown fence:
{"tensions": [{"a": 0, "b": 2, "description": "...", "historicalNote": "...", "salience": 2}]}

If nothing qualifies, respond exactly: {"tensions": []}`;
}

export function buildTensionUserPrompt(
  positions: JudgePosition[],
  coveredIndexPairs: IndexPair[],
  framework?: string,
): string {
  const frameworkLabel = framework
    ? (getFramework(framework)?.label ?? framework)
    : "not specified";
  const lines = positions.map(
    (p, i) =>
      `[${i}] (${p.locus} / ${p.topic}, ${p.stance}) ${p.statement}`,
  );
  const covered =
    coveredIndexPairs.length > 0
      ? `\n\nAlready reviewed — do NOT report these pairs again: ${coveredIndexPairs
          .map(([a, b]) => `(${a}, ${b})`)
          .join(", ")}`
      : "";
  return `The user studies within this tradition: ${frameworkLabel}.

Positions the user has affirmed:
${lines.join("\n")}${covered}`;
}

function normalizeNote(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_TEXT_CHARS) return undefined;
  return trimmed;
}

/**
 * Fail-closed parser for the judgment response, in the same spirit as
 * lib/extraction.ts: malformed payloads yield []; malformed items are
 * dropped; a false tension is worse than a missed one.
 */
export function parseTensionResponse(
  raw: string,
  positionCount: number,
  coveredIndexPairs: IndexPair[],
): ParsedTension[] {
  let text = raw.trim();
  if (text.startsWith("```")) {
    text = text.replace(/^```[a-z]*\s*/i, "").replace(/```\s*$/, "");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return [];
  }
  if (typeof parsed !== "object" || parsed === null) return [];
  const tensions = (parsed as { tensions?: unknown }).tensions;
  if (!Array.isArray(tensions)) return [];

  const seen = new Set(coveredIndexPairs.map(([a, b]) => pairKey(String(a), String(b))));
  const out: ParsedTension[] = [];
  for (const candidate of tensions) {
    if (out.length >= MAX_TENSIONS_PER_PASS) break;
    if (typeof candidate !== "object" || candidate === null) continue;
    const { a, b, description, historicalNote, salience } = candidate as Record<
      string,
      unknown
    >;
    if (typeof a !== "number" || !Number.isInteger(a)) continue;
    if (typeof b !== "number" || !Number.isInteger(b)) continue;
    if (a === b) continue;
    if (a < 0 || b < 0 || a >= positionCount || b >= positionCount) continue;
    const [lo, hi] = a < b ? [a, b] : [b, a];
    const key = pairKey(String(lo), String(hi));
    if (seen.has(key)) continue;
    if (typeof salience !== "number" || !Number.isInteger(salience)) continue;
    if (salience < 1 || salience > 3) continue;
    if (typeof description !== "string") continue;
    const trimmedDescription = description.trim();
    if (!trimmedDescription || trimmedDescription.length > MAX_TEXT_CHARS) continue;
    const note = normalizeNote(historicalNote);
    if (BANNED.test(trimmedDescription) || (note && BANNED.test(note))) continue;
    seen.add(key);
    out.push({
      a: lo,
      b: hi,
      description: trimmedDescription,
      historicalNote: note,
      salience,
    });
  }
  return out;
}

/**
 * The profile surfaces at most MAX_OPEN_SURFACED open tensions, strongest
 * first (docs/THEOLOGICAL_PROFILE.md §Risks, tension fatigue).
 */
export function selectOpenTensions<
  T extends { salience: number; createdAt: number },
>(tensions: T[]): T[] {
  return [...tensions]
    .sort((x, y) => y.salience - x.salience || y.createdAt - x.createdAt)
    .slice(0, MAX_OPEN_SURFACED);
}

/** The seeded first message for the Study this action. Neutral register. */
export function buildStudyPrompt(statementA: string, statementB: string): string {
  return `In my study I've affirmed two positions that may sit uneasily together:

1. "${statementA}"
2. "${statementB}"

Help me study how these relate. Where does the pressure between them lie, what is at stake in holding both, and how has the church wrestled with this?`;
}

import {
  LOCI,
  LOCUS_IDS,
  STANCES,
  STRENGTHS,
  type LocusId,
  type Stance,
  type Strength,
} from "./profile";
import { getFramework, type ModeId } from "./studyData";

export type ExtractedClaim = {
  locus: LocusId;
  topic: string;
  statement: string;
  stance: Stance;
  strength: Strength;
};

export const MAX_CLAIMS_PER_PASS = 10;
export const MAX_STATEMENT_CHARS = 300;
const MAX_MESSAGE_CHARS = 4000;

/** Modes where the user deliberately voices positions they do not hold. */
const ADVERSARIAL_MODES: readonly ModeId[] = ["devils-advocate", "debate-prep"];

export function buildExtractionPrompt(mode: ModeId, framework?: string): string {
  const frameworkLabel = framework
    ? (getFramework(framework)?.label ?? framework)
    : "not specified";
  const lociList = LOCI.map((l) => `- ${l.id} (${l.label})`).join("\n");

  const adversarialWarning = ADVERSARIAL_MODES.includes(mode)
    ? `

ADVERSARIAL TRANSCRIPT WARNING. This conversation ran in a debate mode where the assistant argued for an opposing tradition and the user may voice the opposing side to test it. A user restating, steel-manning, or probing an opposing argument is NOT an affirmation. Only extract what the user defends or affirms as genuinely their own — a user defending a position under pressure is a strong affirmation; a user articulating the other side is not one at all. When the two are hard to tell apart, extract nothing.`
    : "";

  return `You extract theological positions a user has personally affirmed in a study conversation.

The transcript below is from a conversation in "${mode}" mode. The user studies within this tradition: ${frameworkLabel}.

THE ONE HARD RULE: extract only what the user affirmed in their own voice. Never extract:
- anything the assistant said, however confidently
- questions the user asked, or topics the user merely studied
- positions the user voiced while representing an opponent's view
- hedged musings that stop short of affirmation

The signal is first-person affirmation: "I hold", "that's my view", "I'd answer that objection by", explicit agreement after a challenge. When in doubt, extract nothing — return an empty claims array. A sparse accurate profile beats a full noisy one.${adversarialWarning}

For each genuine affirmation, produce a claim with:
- "locus": exactly one of these ids (the classical theological loci):
${lociList}
- "topic": a short kebab-case slug for the doctrine (e.g. "election", "baptismal-efficacy")
- "statement": ONE sentence in the user's own voice stating the position (e.g. "Regeneration precedes faith."), under ${MAX_STATEMENT_CHARS} characters
- "stance": "affirmed" | "denied" | "uncertain" — relative to the statement
- "strength": "settled" (stated as conviction) | "leaning" (inclined, some reservation) | "exploring" (trying the position on)

Respond with STRICT JSON only, no prose, no markdown fence:
{"claims": [{"locus": "...", "topic": "...", "statement": "...", "stance": "...", "strength": "..."}]}

If nothing qualifies, respond exactly: {"claims": []}`;
}

/** Shared by extraction parsing and user edits: one sentence, bounded. */
export function isValidStatementLength(statement: string): boolean {
  return statement.length <= MAX_STATEMENT_CHARS;
}

export function normalizeTopic(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isValidClaim(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Fail-closed parser for the extraction response. Malformed payloads yield
 * []; malformed individual claims are dropped. Every misattributed belief is
 * a trust incident, so the bias is always toward extracting less.
 */
export function parseExtractionResponse(raw: string): ExtractedClaim[] {
  let text = raw.trim();
  // Tolerate a model that wraps the JSON in a markdown fence anyway.
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
  const claims = (parsed as { claims?: unknown }).claims;
  if (!Array.isArray(claims)) return [];

  const out: ExtractedClaim[] = [];
  for (const candidate of claims) {
    if (out.length >= MAX_CLAIMS_PER_PASS) break;
    if (!isValidClaim(candidate)) continue;
    const { locus, topic, statement, stance, strength } = candidate;
    if (typeof locus !== "string" || !(LOCUS_IDS as readonly string[]).includes(locus)) continue;
    if (typeof stance !== "string" || !(STANCES as readonly string[]).includes(stance)) continue;
    if (typeof strength !== "string" || !(STRENGTHS as readonly string[]).includes(strength)) continue;
    if (typeof statement !== "string") continue;
    const trimmedStatement = statement.trim();
    if (!trimmedStatement || trimmedStatement.length > MAX_STATEMENT_CHARS) continue;
    if (typeof topic !== "string") continue;
    const slug = normalizeTopic(topic);
    if (!slug) continue;
    out.push({
      locus: locus as LocusId,
      topic: slug,
      statement: trimmedStatement,
      stance: stance as Stance,
      strength: strength as Strength,
    });
  }
  return out;
}

/** Role-labeled plain-text transcript for the extraction pass. */
export function buildTranscript(
  messages: Array<{ role: string; text?: string }>,
): string {
  const parts: string[] = [];
  for (const message of messages) {
    const text = message.text?.trim();
    if (!text) continue;
    const clipped =
      text.length > MAX_MESSAGE_CHARS
        ? `${text.slice(0, MAX_MESSAGE_CHARS)} [truncated]`
        : text;
    parts.push(`${message.role.toUpperCase()}: ${clipped}`);
  }
  return parts.join("\n\n");
}

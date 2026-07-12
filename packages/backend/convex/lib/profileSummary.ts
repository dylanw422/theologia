import {
  getLocusLabel,
  latestPerTopic,
  type LocusId,
  type Stance,
  type Strength,
} from "./profile";

/**
 * Phase 3 prompt injection (docs/THEOLOGICAL_PROFILE.md §4). The summary is
 * assembled deterministically from position rows — statements are already
 * one-sentence, user-voice strings, so concatenation IS the summary. No
 * model call, no cache, no staleness.
 */
export type SummaryPosition = {
  locus: LocusId;
  topic: string;
  statement: string;
  stance: Stance;
  strength: Strength;
  createdAt: number;
  excluded: boolean;
};

/** ~600 tokens. A hard truncation, not a hope (spec's words). */
export const PROFILE_SUMMARY_MAX_CHARS = 2400;

const STRENGTH_ORDER: Record<Strength, number> = {
  settled: 0,
  leaning: 1,
  exploring: 2,
};

/**
 * Latest non-excluded claim per topic, settled → leaning → exploring, newest
 * first within a band. Truncation keeps whole lines and stops at the first
 * overflow, so settled positions survive and exploring ones fall off first.
 * Returns null when nothing qualifies — an empty profile injects nothing.
 */
export function buildProfileSummary(
  positions: SummaryPosition[],
): string | null {
  const latest = latestPerTopic(positions).sort(
    (a, b) =>
      STRENGTH_ORDER[a.strength] - STRENGTH_ORDER[b.strength] ||
      b.createdAt - a.createdAt,
  );

  const lines: string[] = [];
  let total = 0;
  for (const position of latest) {
    const locus = getLocusLabel(position.locus) ?? position.locus;
    const line = `- [${locus} / ${position.topic}] ${position.statement} (${position.stance}, ${position.strength})`;
    const cost = line.length + (lines.length > 0 ? 1 : 0);
    if (total + cost > PROFILE_SUMMARY_MAX_CHARS) break;
    lines.push(line);
    total += cost;
  }
  return lines.length > 0 ? lines.join("\n") : null;
}

/**
 * The system-prompt section around the summary. Register per GOAL.md: build
 * on the user's study, never police it. The followup rule here IS the
 * "tension followup chips" feature — the <followups> tag already renders
 * as chips end-to-end.
 */
export function buildProfileSection(summary: string): string {
  return `## The user's theological profile

The user has opted into a theological profile: positions they have affirmed in their own voice across their prior study, recorded one sentence at a time. These are their words, not yours.

${summary}

How to use this:
- Build on these positions instead of re-explaining ground the user has already worked through.
- Never volunteer observations about the profile that the user did not ask for, and never grade or comment on its consistency.
- When your reply bears directly on one of these positions, you may end with a <followups> chip connecting them (for example: How does this square with my view of election?). Only when genuinely apt — the user pulls; you never push.`;
}

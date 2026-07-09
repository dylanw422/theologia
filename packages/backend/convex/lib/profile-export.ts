import { LOCI, type LocusId, type Stance, type Strength } from "./profile";

export type ExportPosition = {
  locus: LocusId;
  topic: string;
  statement: string;
  stance: Stance;
  strength: Strength;
  frameworkLabel?: string;
  createdAt: number;
};

function isoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * The user's confession as a portable markdown document. It's their
 * confession — they should be able to keep it (docs/THEOLOGICAL_PROFILE.md,
 * User control).
 */
export function buildProfileMarkdown(
  positions: ExportPosition[],
  generatedAt: number,
): string {
  const lines: string[] = [
    "# Your Theology",
    "",
    `> Exported from Theologia on ${isoDate(generatedAt)}. Assembled from positions you affirmed in your own study conversations.`,
    "",
  ];

  if (positions.length === 0) {
    lines.push("_No positions recorded yet — this document grows as you study._", "");
    return lines.join("\n");
  }

  for (const locus of LOCI) {
    const inLocus = positions.filter((p) => p.locus === locus.id);
    if (inLocus.length === 0) continue;
    lines.push(`## ${locus.label}`, "");
    for (const p of inLocus) {
      const apparatus = [p.stance, p.strength, p.frameworkLabel, isoDate(p.createdAt)]
        .filter(Boolean)
        .join(" · ");
      lines.push(`**${p.statement}**`, "", `*${apparatus}*`, "");
    }
  }
  return lines.join("\n");
}

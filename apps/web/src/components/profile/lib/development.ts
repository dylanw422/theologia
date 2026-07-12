/**
 * Development-over-time view helpers (Phase 3): the positions table is
 * append-only, so a topic's history is its list of claims oldest-first.
 */

export function topicHistories<T extends { topic: string }>(
  history: T[],
): Map<string, T[]> {
  const byTopic = new Map<string, T[]>();
  for (const entry of history) {
    const list = byTopic.get(entry.topic);
    if (list) list.push(entry);
    else byTopic.set(entry.topic, [entry]);
  }
  return byTopic;
}

const MONTH = new Intl.DateTimeFormat("en-US", { month: "short" });
const MONTH_YEAR = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
});

/** "3 positions, Mar → Jul" — entries must be oldest-first and ≥2 long. */
export function developmentLabel(
  entries: ReadonlyArray<{ createdAt: number }>,
): string {
  const first = new Date(entries[0].createdAt);
  const last = new Date(entries[entries.length - 1].createdAt);
  const format =
    first.getFullYear() === last.getFullYear() ? MONTH : MONTH_YEAR;
  return `${entries.length} positions, ${format.format(first)} → ${format.format(last)}`;
}

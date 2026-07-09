import { v } from "convex/values";

/**
 * The eight classical theological loci — the fixed skeleton of the profile.
 * The order here is canonical: the profile page and the markdown export
 * both render loci in this order.
 */
export const LOCI = [
  { id: "scripture-revelation", label: "Scripture & Revelation" },
  { id: "theology-proper", label: "Theology Proper" },
  { id: "christology", label: "Christology" },
  { id: "pneumatology", label: "Pneumatology" },
  { id: "anthropology-sin", label: "Anthropology & Sin" },
  { id: "soteriology", label: "Soteriology" },
  { id: "ecclesiology-sacraments", label: "Ecclesiology & Sacraments" },
  { id: "eschatology", label: "Eschatology" },
] as const;

export type LocusId = (typeof LOCI)[number]["id"];

export const LOCUS_IDS: readonly LocusId[] = LOCI.map((l) => l.id);

export function getLocusLabel(id: string): string | undefined {
  return LOCI.find((l) => l.id === id)?.label;
}

export const STANCES = ["affirmed", "denied", "uncertain"] as const;
export const STRENGTHS = ["settled", "leaning", "exploring"] as const;
export type Stance = (typeof STANCES)[number];
export type Strength = (typeof STRENGTHS)[number];

export const vLocus = v.union(
  v.literal("scripture-revelation"),
  v.literal("theology-proper"),
  v.literal("christology"),
  v.literal("pneumatology"),
  v.literal("anthropology-sin"),
  v.literal("soteriology"),
  v.literal("ecclesiology-sacraments"),
  v.literal("eschatology"),
);

export const vStance = v.union(
  v.literal("affirmed"),
  v.literal("denied"),
  v.literal("uncertain"),
);

export const vStrength = v.union(
  v.literal("settled"),
  v.literal("leaning"),
  v.literal("exploring"),
);

/**
 * The profile shows one position per topic: the latest non-excluded claim.
 * Earlier claims stay in the table as history (Phase 3's development view).
 * Output is newest-first.
 */
export function latestPerTopic<
  T extends { topic: string; createdAt: number; excluded: boolean },
>(positions: T[]): T[] {
  const byTopic = new Map<string, T>();
  for (const position of positions) {
    if (position.excluded) continue;
    const prev = byTopic.get(position.topic);
    if (!prev || position.createdAt > prev.createdAt) {
      byTopic.set(position.topic, position);
    }
  }
  return [...byTopic.values()].sort((a, b) => b.createdAt - a.createdAt);
}

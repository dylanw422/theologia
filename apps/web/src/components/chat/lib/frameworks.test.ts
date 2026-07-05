import { describe, expect, it } from "vitest";

import { FRAMEWORKS, getFramework } from "./frameworks";

describe("frameworks", () => {
  it("lists the 12 GOAL.md traditions alphabetically with short display labels", () => {
    expect(FRAMEWORKS).toHaveLength(12);
    const labels = FRAMEWORKS.map((f) => f.label);
    expect(labels).toEqual([
      "Anabaptist",
      "Anglican",
      "Arminian",
      "Baptist",
      "Covenant Theology (non-Reformed)",
      "Dispensationalist Evangelical",
      "Eastern Orthodox",
      "Lutheran",
      "Oneness Pentecostal",
      "Pentecostal",
      "Reformed",
      "Roman Catholic",
    ]);
    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b)));
  });

  it("gives every framework a stable, unique id", () => {
    const ids = FRAMEWORKS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => /^[a-z0-9-]+$/.test(id))).toBe(true);
  });

  it("carries the sub-traditions for Reformed / Calvinist", () => {
    const reformed = getFramework("reformed");
    expect(reformed?.subTraditions.map((s) => s.label)).toEqual([
      "Presbyterian",
      "Dutch Reformed",
      "Reformed Baptist",
      "Continental Reformed",
    ]);
  });

  it("returns undefined for an unknown framework id", () => {
    expect(getFramework("nonexistent")).toBeUndefined();
  });
});

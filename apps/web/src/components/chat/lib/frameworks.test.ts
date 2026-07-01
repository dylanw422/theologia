import { describe, expect, it } from "vitest";

import { FRAMEWORKS, getFramework } from "./frameworks";

describe("frameworks", () => {
  it("lists the 12 GOAL.md traditions with short display labels", () => {
    expect(FRAMEWORKS).toHaveLength(12);
    expect(FRAMEWORKS.map((f) => f.label)).toEqual([
      "Reformed",
      "Lutheran",
      "Arminian",
      "Roman Catholic",
      "Eastern Orthodox",
      "Baptist",
      "Anglican",
      "Pentecostal",
      "Oneness Pentecostal",
      "Anabaptist",
      "Dispensationalist Evangelical",
      "Covenant Theology (non-Reformed)",
    ]);
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

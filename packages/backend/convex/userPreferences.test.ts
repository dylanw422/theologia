/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";

import { api } from "./_generated/api";
import schema from "./schema";
import { preferencesForUser, upsertDefaultFramework } from "./userPreferences";

const modules = import.meta.glob("./**/*.ts");

describe("userPreferences helpers", () => {
  test("upsertDefaultFramework creates then updates a single row", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      expect(await preferencesForUser(ctx as never, "u1")).toBeNull();

      await upsertDefaultFramework(ctx as never, "u1", "reformed");
      let prefs = await preferencesForUser(ctx as never, "u1");
      expect(prefs?.defaultFramework).toBe("reformed");

      await upsertDefaultFramework(ctx as never, "u1", "baptist");
      prefs = await preferencesForUser(ctx as never, "u1");
      expect(prefs?.defaultFramework).toBe("baptist");

      const rows = await ctx.db.query("userPreferences").collect();
      expect(rows).toHaveLength(1);
    });
  });

  test("upsertDefaultFramework rejects an unknown tradition id", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await expect(
        upsertDefaultFramework(ctx as never, "u1", "not-a-tradition"),
      ).rejects.toThrow("Unknown tradition");
    });
  });
});

describe("getDefaultFramework", () => {
  test("null when unauthenticated", async () => {
    const t = convexTest(schema, modules);
    expect(
      await t.query(api.userPreferences.getDefaultFramework, {}),
    ).toBeNull();
  });
});

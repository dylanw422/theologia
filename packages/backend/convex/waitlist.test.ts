// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { api, internal } from "./_generated/api";
import schema from "./schema";
import { sendBetaInvite } from "./waitlist";

const modules = import.meta.glob("./**/*.ts");

describe("setBetaToken", () => {
  beforeEach(() => {
    process.env.SITE_URL = "https://theologia.app";
  });

  test("creates a waitlist row when the email is new", async () => {
    const t = convexTest(schema, modules);

    const result = await t.mutation(internal.waitlist.setBetaToken, {
      email: "New@Theologia.app",
    });

    const rows = await t.run((ctx) => ctx.db.query("waitlist").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBe("new@theologia.app"); // normalized
    expect(rows[0].betaApproved).toBe(true);
    expect(rows[0].betaToken).toEqual(expect.any(String));
    expect(result.url).toBe(
      `https://theologia.app/api/beta?token=${rows[0].betaToken}`,
    );
  });

  test("approves an existing row without duplicating it", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.waitlist.join, { email: "existing@theologia.app" });

    await t.mutation(internal.waitlist.setBetaToken, {
      email: "existing@theologia.app",
    });

    const rows = await t.run((ctx) => ctx.db.query("waitlist").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0].betaApproved).toBe(true);
  });

  test("rotates the token on re-approval", async () => {
    const t = convexTest(schema, modules);
    const first = await t.mutation(internal.waitlist.setBetaToken, {
      email: "rotate@theologia.app",
    });
    const second = await t.mutation(internal.waitlist.setBetaToken, {
      email: "rotate@theologia.app",
    });

    expect(second.url).not.toBe(first.url);
    const rows = await t.run((ctx) => ctx.db.query("waitlist").collect());
    expect(rows).toHaveLength(1);
  });
});

describe("resolveBetaToken", () => {
  test("returns the email for a valid approved token", async () => {
    const t = convexTest(schema, modules);
    process.env.SITE_URL = "https://theologia.app";
    await t.mutation(internal.waitlist.setBetaToken, {
      email: "valid@theologia.app",
    });
    const token = await t.run(async (ctx) => {
      const row = await ctx.db.query("waitlist").first();
      return row!.betaToken!;
    });

    const result = await t.query(api.waitlist.resolveBetaToken, { token });

    expect(result).toEqual({ email: "valid@theologia.app" });
  });

  test("returns null for an unknown token", async () => {
    const t = convexTest(schema, modules);

    const result = await t.query(api.waitlist.resolveBetaToken, {
      token: "does-not-exist",
    });

    expect(result).toBeNull();
  });

  test("returns null after the user is revoked", async () => {
    const t = convexTest(schema, modules);
    process.env.SITE_URL = "https://theologia.app";
    await t.mutation(internal.waitlist.setBetaToken, {
      email: "revoked@theologia.app",
    });
    const token = await t.run(async (ctx) => {
      const row = await ctx.db.query("waitlist").first();
      return row!.betaToken!;
    });

    await t.mutation(internal.waitlist.revokeBeta, {
      email: "revoked@theologia.app",
    });
    const result = await t.query(api.waitlist.resolveBetaToken, { token });

    expect(result).toBeNull();
  });
});

describe("revokeBeta", () => {
  test("clears approval and token but keeps the waitlist row", async () => {
    const t = convexTest(schema, modules);
    process.env.SITE_URL = "https://theologia.app";
    await t.mutation(internal.waitlist.setBetaToken, {
      email: "keep@theologia.app",
    });

    await t.mutation(internal.waitlist.revokeBeta, {
      email: "keep@theologia.app",
    });

    const rows = await t.run((ctx) => ctx.db.query("waitlist").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0].betaApproved).toBeUndefined();
    expect(rows[0].betaToken).toBeUndefined();
  });
});

describe("sendBetaInvite", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    process.env.RESEND_API_KEY = "re_test_key";
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
  });
  afterEach(() => vi.unstubAllGlobals());

  test("posts the magic link to the Resend API with auth", async () => {
    await sendBetaInvite(
      "invitee@theologia.app",
      "https://theologia.app/api/beta?token=abc123",
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.headers.Authorization).toBe("Bearer re_test_key");
    const body = JSON.parse(init.body);
    expect(body.to).toBe("invitee@theologia.app");
    expect(JSON.stringify(body)).toContain(
      "https://theologia.app/api/beta?token=abc123",
    );
  });

  test("throws when Resend responds with an error", async () => {
    fetchMock.mockResolvedValue(new Response("nope", { status: 422 }));

    await expect(
      sendBetaInvite("invitee@theologia.app", "https://theologia.app/x"),
    ).rejects.toThrow();
  });
});

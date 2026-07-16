import { describe, expect, test } from "vitest";

import { signBetaPass, verifyBetaPass } from "./beta-pass";

const SECRET = "test-secret-value-with-entropy";

describe("beta-pass cookie", () => {
  test("verifies a freshly signed pass and returns the email", async () => {
    const value = await signBetaPass("beta@theologia.app", {
      secret: SECRET,
      expiresAt: Date.now() + 60_000,
    });

    const result = await verifyBetaPass(value, { secret: SECRET });

    expect(result).toEqual({ email: "beta@theologia.app" });
  });

  test("rejects a pass whose signature was tampered with", async () => {
    const value = await signBetaPass("beta@theologia.app", {
      secret: SECRET,
      expiresAt: Date.now() + 60_000,
    });
    const [payload] = value.split(".");
    const forged = `${payload}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`;

    const result = await verifyBetaPass(forged, { secret: SECRET });

    expect(result).toBeNull();
  });

  test("rejects a pass signed with a different secret", async () => {
    const value = await signBetaPass("beta@theologia.app", {
      secret: "some-other-secret",
      expiresAt: Date.now() + 60_000,
    });

    const result = await verifyBetaPass(value, { secret: SECRET });

    expect(result).toBeNull();
  });

  test("rejects an expired pass", async () => {
    const value = await signBetaPass("beta@theologia.app", {
      secret: SECRET,
      expiresAt: Date.now() - 1,
    });

    const result = await verifyBetaPass(value, { secret: SECRET });

    expect(result).toBeNull();
  });

  test("rejects a malformed value", async () => {
    expect(await verifyBetaPass("", { secret: SECRET })).toBeNull();
    expect(await verifyBetaPass("not-a-pass", { secret: SECRET })).toBeNull();
    expect(
      await verifyBetaPass("only.two", { secret: SECRET }),
    ).toBeNull();
  });
});

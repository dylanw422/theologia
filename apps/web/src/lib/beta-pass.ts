// Stateless "beta pass" cookie. A beta user redeems their magic link at
// /api/beta, which mints one of these; the middleware (proxy.ts) verifies it
// on every request without touching Convex. Value is `<payload>.<signature>`,
// both base64url, where payload is `<email>:<expiresAtMs>` and signature is an
// HMAC-SHA256 of the payload under BETA_SECRET. Web Crypto only, so the same
// code runs in the Node route handler and the edge middleware.

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function hmac(payload: string, secret: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  return new Uint8Array(sig);
}

// Length-independent constant-time comparison of two byte arrays.
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function signBetaPass(
  email: string,
  opts: { secret: string; expiresAt: number },
): Promise<string> {
  const payload = `${email}:${opts.expiresAt}`;
  const encodedPayload = toBase64Url(new TextEncoder().encode(payload));
  const signature = toBase64Url(await hmac(payload, opts.secret));
  return `${encodedPayload}.${signature}`;
}

export async function verifyBetaPass(
  value: string,
  opts: { secret: string; now?: number },
): Promise<{ email: string } | null> {
  const parts = value.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;

  const [encodedPayload, signature] = parts;
  let payload: string;
  try {
    payload = new TextDecoder().decode(fromBase64Url(encodedPayload));
  } catch {
    return null;
  }

  const expected = await hmac(payload, opts.secret);
  let provided: Uint8Array;
  try {
    provided = fromBase64Url(signature);
  } catch {
    return null;
  }
  if (!timingSafeEqual(expected, provided)) return null;

  const sep = payload.lastIndexOf(":");
  if (sep === -1) return null;
  const email = payload.slice(0, sep);
  const expiresAt = Number(payload.slice(sep + 1));
  if (!email || !Number.isFinite(expiresAt)) return null;
  if ((opts.now ?? Date.now()) >= expiresAt) return null;

  return { email };
}

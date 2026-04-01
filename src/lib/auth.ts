const COOKIE_NAME = "dm_session";

export type SessionPayload = {
  sub: string;
  exp: number;
};

function getSecret() {
  return process.env.AUTH_SECRET || "dev-secret-change-me";
}

function base64EncodeBytes(bytes: Uint8Array) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }

  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function base64DecodeToBytes(base64: string) {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(base64, "base64"));
  }

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function base64UrlEncodeBytes(bytes: Uint8Array) {
  return base64EncodeBytes(bytes)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecodeToBytes(base64url: string) {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "===".slice((base64.length + 3) % 4);
  return base64DecodeToBytes(padded);
}

function base64UrlEncodeString(input: string) {
  const bytes = new TextEncoder().encode(input);
  return base64UrlEncodeBytes(bytes);
}

function base64UrlDecodeToString(input: string) {
  const bytes = base64UrlDecodeToBytes(input);
  return new TextDecoder().decode(bytes);
}

function timingSafeEqualString(a: string, b: string) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

async function hmacSha256Base64Url(data: string) {
  const keyBytes = new TextEncoder().encode(getSecret());
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(data)
  );
  return base64UrlEncodeBytes(new Uint8Array(sig));
}

export function getSessionCookieName() {
  return COOKIE_NAME;
}

function hasNodeCrypto() {
  return (
    typeof process !== "undefined" &&
    !!(process as any).versions?.node &&
    typeof require === "function"
  );
}

function hmacSha256Base64UrlSync(data: string) {
  if (!hasNodeCrypto()) {
    throw new Error("Node crypto is not available in this runtime");
  }
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const nodeCrypto = require("crypto") as typeof import("crypto");
  return nodeCrypto
    .createHmac("sha256", getSecret())
    .update(data)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function timingSafeEqualBase64Url(a: string, b: string) {
  if (hasNodeCrypto()) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const nodeCrypto = require("crypto") as typeof import("crypto");
    const aBuf = Buffer.from(a);
    const bBuf = Buffer.from(b);
    if (aBuf.length !== bBuf.length) return false;
    return nodeCrypto.timingSafeEqual(aBuf, bBuf);
  }

  return timingSafeEqualString(a, b);
}

export function createSessionToken(payload: SessionPayload) {
  const json = JSON.stringify(payload);
  const body = base64UrlEncodeString(json);
  const sig = hmacSha256Base64UrlSync(body);
  return `${body}.${sig}`;
}

export function verifySessionToken(token: string | undefined | null): SessionPayload | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;

  let expected: string;
  try {
    expected = hmacSha256Base64UrlSync(body);
  } catch {
    return null;
  }

  if (!timingSafeEqualBase64Url(sig, expected)) return null;

  try {
    const payload = JSON.parse(base64UrlDecodeToString(body)) as SessionPayload;
    if (!payload?.sub || typeof payload.exp !== "number") return null;
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function createSessionTokenSigned(payload: SessionPayload) {
  const json = JSON.stringify(payload);
  const body = base64UrlEncodeString(json);
  const sig = await hmacSha256Base64Url(body);
  return `${body}.${sig}`;
}

export async function verifySessionTokenSigned(
  token: string | undefined | null
): Promise<SessionPayload | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;

  const expected = await hmacSha256Base64Url(body);
  if (!timingSafeEqualString(sig, expected)) return null;

  try {
    const payload = JSON.parse(base64UrlDecodeToString(body)) as SessionPayload;
    if (!payload?.sub || typeof payload.exp !== "number") return null;
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

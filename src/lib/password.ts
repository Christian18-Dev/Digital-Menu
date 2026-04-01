export type PasswordRecord = {
  salt: string;
  hash: string;
};

function getNodeCrypto() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require("crypto") as typeof import("crypto");
}

export function hashPassword(password: string): PasswordRecord {
  const crypto = getNodeCrypto();
  const salt = crypto.randomBytes(16).toString("base64");
  const hash = crypto
    .pbkdf2Sync(password, salt, 120_000, 32, "sha256")
    .toString("base64");
  return { salt, hash };
}

export function verifyPassword(password: string, record: PasswordRecord): boolean {
  const crypto = getNodeCrypto();
  const expected = Buffer.from(record.hash, "base64");
  const actual = Buffer.from(
    crypto.pbkdf2Sync(password, record.salt, 120_000, 32, "sha256")
  );
  if (expected.length !== actual.length) return false;
  return crypto.timingSafeEqual(expected, actual);
}

import { randomBytes } from "node:crypto";

const TOKEN_ALPHABET =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/**
 * Cryptographically strong opaque token for /p/[token].
 * Server-only — never import this module from Client Components.
 */
export function createCustomerAccessToken(length = 32): string {
  const bytes = randomBytes(length);
  let token = "";
  for (let i = 0; i < length; i += 1) {
    token += TOKEN_ALPHABET[bytes[i]! % TOKEN_ALPHABET.length];
  }
  return token;
}

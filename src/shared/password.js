// Salted PBKDF2-SHA256 password records: { hash, salt, iterations, changed_at }.

export const MIN_PASSWORD_LENGTH = 6;

const ITERATIONS = 310_000;
const SALT_BYTES = 16;
const HASH_BITS = 256;

const toBase64 = (bytes) => btoa(String.fromCharCode(...bytes));
const fromBase64 = (text) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

async function derive(password, salt, iterations) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, HASH_BITS);
  return new Uint8Array(bits);
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derive(password, salt, ITERATIONS);
  return { hash: toBase64(hash), salt: toBase64(salt), iterations: ITERATIONS, changed_at: Date.now() };
}

export async function verifyPassword(password, record) {
  if (!record?.hash || !record.salt) return false;
  const expected = fromBase64(record.hash);
  const actual = await derive(password, fromBase64(record.salt), record.iterations);
  if (expected.length !== actual.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected[i] ^ actual[i];
  return diff === 0;
}

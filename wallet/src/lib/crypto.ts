import { gcm } from '@noble/ciphers/aes.js';
import { p256 } from '@noble/curves/nist.js';
import { pbkdf2 } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { base64UrlEncodeJson, bytesToBase64Url, utf8 } from './encoding';

export { sha256 };

export function randomBytes(length: number): Uint8Array {
  const out = new Uint8Array(length);
  globalThis.crypto.getRandomValues(out);
  return out;
}

export function randomId(): string {
  return bytesToBase64Url(randomBytes(16));
}

/** AES-256-GCM; output is nonce (12 bytes) followed by ciphertext+tag. */
export function encrypt(key: Uint8Array, plaintext: Uint8Array): Uint8Array {
  const nonce = randomBytes(12);
  const sealed = gcm(key, nonce).encrypt(plaintext);
  const out = new Uint8Array(nonce.length + sealed.length);
  out.set(nonce);
  out.set(sealed, nonce.length);
  return out;
}

export function decrypt(key: Uint8Array, data: Uint8Array): Uint8Array {
  return gcm(key, data.subarray(0, 12)).decrypt(data.subarray(12));
}

export const PIN_ITERATIONS = 60_000;

export function hashPin(pin: string, salt: Uint8Array, iterations = PIN_ITERATIONS): Uint8Array {
  return pbkdf2(sha256, utf8(pin), salt, { c: iterations, dkLen: 32 });
}

export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export type PublicJwk = { kty: 'EC'; crv: 'P-256'; x: string; y: string };

export type HolderKey = { id: string; privateKey: string; publicJwk: PublicJwk };

export function generateHolderKey(): HolderKey {
  const secret = p256.utils.randomSecretKey();
  return { id: randomId(), privateKey: bytesToBase64Url(secret), publicJwk: publicJwkFromSecret(secret) };
}

export function publicJwkFromSecret(secret: Uint8Array): PublicJwk {
  const uncompressed = p256.getPublicKey(secret, false);
  return {
    kty: 'EC',
    crv: 'P-256',
    x: bytesToBase64Url(uncompressed.subarray(1, 33)),
    y: bytesToBase64Url(uncompressed.subarray(33, 65)),
  };
}

/** Raw r||s ES256 signature over SHA-256(message), as required by JWS. */
export function signEs256(secret: Uint8Array, message: Uint8Array): Uint8Array {
  return p256.sign(message, secret, { prehash: true, lowS: true, format: 'compact' });
}

export function verifyEs256(publicKey: Uint8Array, message: Uint8Array, signature: Uint8Array): boolean {
  return p256.verify(signature, message, publicKey, { prehash: true, lowS: false, format: 'compact' });
}

export function signJwt(secret: Uint8Array, header: Record<string, unknown>, payload: Record<string, unknown>): string {
  const input = `${base64UrlEncodeJson({ alg: 'ES256', ...header })}.${base64UrlEncodeJson(payload)}`;
  return `${input}.${bytesToBase64Url(signEs256(secret, utf8(input)))}`;
}

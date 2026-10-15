// JOSE pieces the wallet needs beyond plain ES256 signing: JWS verification, JWK thumbprints,
// DPoP proofs (RFC 9449) and ECDH-ES JWE encryption for direct_post.jwt responses (RFC 7516/7518).
import { gcm } from '@noble/ciphers/aes.js';
import { p256 } from '@noble/curves/nist.js';
import { randomBytes, randomId, sha256, signJwt, verifyEs256, type HolderKey, type PublicJwk } from '../lib/crypto';
import { base64UrlDecodeJson, base64UrlEncodeJson, base64UrlToBytes, bytesToBase64Url, utf8 } from '../lib/encoding';

export type Jws = { header: Record<string, unknown>; payload: Record<string, unknown>; signingInput: string; signature: Uint8Array };

export function decodeJws(jws: string): Jws {
  const [h, p, s] = jws.split('.');
  if (!h || !p || s === undefined) throw new Error('Not a compact JWS');
  return {
    header: base64UrlDecodeJson(h),
    payload: base64UrlDecodeJson(p),
    signingInput: `${h}.${p}`,
    signature: base64UrlToBytes(s),
  };
}

export function verifyJwsEs256(jws: Jws, publicKey: Uint8Array): boolean {
  if (jws.header.alg !== 'ES256') return false;
  try {
    return verifyEs256(publicKey, utf8(jws.signingInput), jws.signature);
  } catch {
    return false;
  }
}

export function jwkToPoint(jwk: { x: string; y: string }): Uint8Array {
  const out = new Uint8Array(65);
  out[0] = 4;
  out.set(base64UrlToBytes(jwk.x), 1);
  out.set(base64UrlToBytes(jwk.y), 33);
  return out;
}

/** RFC 7638 thumbprint of an EC public key. */
export function jwkThumbprint(jwk: { crv: string; kty: string; x: string; y: string }): Uint8Array {
  return sha256(utf8(`{"crv":"${jwk.crv}","kty":"${jwk.kty}","x":"${jwk.x}","y":"${jwk.y}"}`));
}

export function dpopProof(key: HolderKey, method: string, url: string, opts: { nonce?: string; accessToken?: string } = {}): string {
  const htu = url.split('#')[0].split('?')[0];
  return signJwt(
    base64UrlToBytes(key.privateKey),
    { typ: 'dpop+jwt', jwk: key.publicJwk },
    {
      jti: randomId(),
      htm: method,
      htu,
      iat: Math.floor(Date.now() / 1000),
      ...(opts.nonce ? { nonce: opts.nonce } : {}),
      ...(opts.accessToken ? { ath: bytesToBase64Url(sha256(utf8(opts.accessToken))) } : {}),
    },
  );
}

function u32(n: number): Uint8Array {
  return Uint8Array.of((n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255);
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/** NIST SP 800-56A Concat KDF as profiled in RFC 7518 section 4.6.2 (single round, keys up to 256 bits). */
export function concatKdf(
  z: Uint8Array,
  algorithmId: string,
  keyBits: number,
  apu: Uint8Array = new Uint8Array(0),
  apv: Uint8Array = new Uint8Array(0),
): Uint8Array {
  const alg = utf8(algorithmId);
  const otherInfo = concat(u32(alg.length), alg, u32(apu.length), apu, u32(apv.length), apv, u32(keyBits));
  return sha256(concat(u32(1), z, otherInfo)).slice(0, keyBits / 8);
}

export type EncryptionJwk = PublicJwk & { kid?: string; use?: string; alg?: string };

/** Compact JWE with alg ECDH-ES (direct key agreement) and enc A128GCM or A256GCM. */
export function encryptJwe(
  payload: Record<string, unknown>,
  recipient: EncryptionJwk,
  opts: { enc?: 'A128GCM' | 'A256GCM'; apu?: Uint8Array; apv?: Uint8Array } = {},
): string {
  if (recipient.kty !== 'EC' || recipient.crv !== 'P-256') throw new Error('Only P-256 encryption keys are supported');
  const enc = opts.enc ?? 'A128GCM';
  const eph = p256.utils.randomSecretKey();
  const ephPub = p256.getPublicKey(eph, false);
  const z = p256.getSharedSecret(eph, jwkToPoint(recipient), true).slice(1);
  const cek = concatKdf(z, enc, enc === 'A128GCM' ? 128 : 256, opts.apu, opts.apv);
  const header: Record<string, unknown> = {
    alg: 'ECDH-ES',
    enc,
    epk: { kty: 'EC', crv: 'P-256', x: bytesToBase64Url(ephPub.subarray(1, 33)), y: bytesToBase64Url(ephPub.subarray(33)) },
    ...(recipient.kid ? { kid: recipient.kid } : {}),
    ...(opts.apu ? { apu: bytesToBase64Url(opts.apu) } : {}),
    ...(opts.apv ? { apv: bytesToBase64Url(opts.apv) } : {}),
  };
  const protectedB64 = base64UrlEncodeJson(header);
  const iv = randomBytes(12);
  const sealed = gcm(cek, iv, utf8(protectedB64)).encrypt(utf8(JSON.stringify(payload)));
  const ciphertext = sealed.subarray(0, sealed.length - 16);
  const tag = sealed.subarray(sealed.length - 16);
  return `${protectedB64}..${bytesToBase64Url(iv)}.${bytesToBase64Url(ciphertext)}.${bytesToBase64Url(tag)}`;
}

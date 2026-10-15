import { expect, test } from '@jest/globals';
import { createPublicKey, verify } from 'node:crypto';
import { constantTimeEqual, decrypt, encrypt, generateHolderKey, hashPin, randomBytes, signJwt } from './crypto';
import { base64UrlToBytes, utf8 } from './encoding';

test('AES-GCM round trip and tamper detection', () => {
  const key = randomBytes(32);
  const sealed = encrypt(key, utf8('denarnica'));
  expect(new TextDecoder().decode(decrypt(key, sealed))).toBe('denarnica');
  sealed[sealed.length - 1] ^= 1;
  expect(() => decrypt(key, sealed)).toThrow();
});

test('ES256 JWT verifies with Node crypto', () => {
  const key = generateHolderKey();
  const jwt = signJwt(base64UrlToBytes(key.privateKey), { typ: 'JWT' }, { hello: 'svet' });
  const [h, p, s] = jwt.split('.');
  const pub = createPublicKey({ key: key.publicJwk, format: 'jwk' });
  const ok = verify('sha256', Buffer.from(`${h}.${p}`), { key: pub, dsaEncoding: 'ieee-p1363' }, Buffer.from(s, 'base64url'));
  expect(ok).toBe(true);
});

test('PIN hash is deterministic per salt', () => {
  const salt = randomBytes(16);
  expect(constantTimeEqual(hashPin('123456', salt, 1000), hashPin('123456', salt, 1000))).toBe(true);
  expect(constantTimeEqual(hashPin('123456', salt, 1000), hashPin('123457', salt, 1000))).toBe(false);
});

import { expect, test } from '@jest/globals';
import { calculateJwkThumbprint, compactDecrypt, exportJWK, generateKeyPair, decodeProtectedHeader } from 'jose';
import { generateHolderKey } from '../lib/crypto';
import { base64UrlToBytes, bytesToBase64Url } from '../lib/encoding';
import { decodeJws, dpopProof, encryptJwe, jwkThumbprint, jwkToPoint, verifyJwsEs256 } from './jose';

test('thumbprint matches jose', async () => {
  const k = generateHolderKey();
  expect(bytesToBase64Url(jwkThumbprint(k.publicJwk))).toBe(await calculateJwkThumbprint(k.publicJwk));
});

test.each(['A128GCM', 'A256GCM'] as const)('JWE %s decrypts with jose', async (enc) => {
  const { publicKey, privateKey } = await generateKeyPair('ECDH-ES', { crv: 'P-256', extractable: true });
  const jwk = (await exportJWK(publicKey)) as { kty: 'EC'; crv: 'P-256'; x: string; y: string };
  const jwe = encryptJwe({ vp_token: { pid: ['abc'] }, state: 's' }, { ...jwk, kid: 'k1' }, { enc, apv: new Uint8Array([1, 2, 3]) });
  expect(decodeProtectedHeader(jwe)).toMatchObject({ alg: 'ECDH-ES', enc, kid: 'k1' });
  const { plaintext } = await compactDecrypt(jwe, privateKey);
  expect(JSON.parse(new TextDecoder().decode(plaintext))).toEqual({ vp_token: { pid: ['abc'] }, state: 's' });
});

test('DPoP proof is a valid ES256 JWS with ath', () => {
  const k = generateHolderKey();
  const jws = decodeJws(dpopProof(k, 'POST', 'https://as.example/token?x=1', { nonce: 'n', accessToken: 'tok' }));
  expect(jws.header).toMatchObject({ typ: 'dpop+jwt', alg: 'ES256' });
  expect(jws.payload).toMatchObject({ htm: 'POST', htu: 'https://as.example/token', nonce: 'n' });
  expect(verifyJwsEs256(jws, jwkToPoint(k.publicJwk))).toBe(true);
  expect(base64UrlToBytes(jws.payload.ath as string)).toHaveLength(32);
});

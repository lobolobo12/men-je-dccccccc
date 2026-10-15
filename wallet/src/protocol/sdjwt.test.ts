import { expect, test } from '@jest/globals';
import { createHash } from 'node:crypto';
import { generateHolderKey } from '../lib/crypto';
import { base64UrlDecodeJson, base64UrlToBytes } from '../lib/encoding';
import { digestOf, issueSdJwtVc, listClaims, parseSdJwt, present } from './sdjwt';

// Example disclosure and digest from RFC 9901 section 5.2.
test('digest matches the RFC example', () => {
  const disclosure = 'WyI2cU1RdlJMNWhhaiIsICJmYW1pbHlfbmFtZSIsICJNw7ZiaXVzIl0';
  expect(digestOf(disclosure)).toBe('uutlBuYeMDyjLLTpf6Jxi7yNkEF35jdyWMn9U7b_RYY');
});

const issuer = generateHolderKey();
const holder = generateHolderKey();

function demo() {
  return issueSdJwtVc(
    base64UrlToBytes(issuer.privateKey),
    {},
    { iss: 'https://issuer.example', vct: 'urn:eudi:pid:1', cnf: { jwk: holder.publicJwk } },
    { given_name: 'Ana', family_name: 'Novak', address: { locality: 'Ljubljana', country: 'SI' }, age_over_18: true },
  );
}

test('parse reconstructs every claim', () => {
  const p = parseSdJwt(demo());
  expect(p.claims).toMatchObject({ given_name: 'Ana', family_name: 'Novak', address: { locality: 'Ljubljana', country: 'SI' }, age_over_18: true });
  const leaves = listClaims(p).map((c) => c.path.join('.')).sort();
  expect(leaves).toEqual(['address.country', 'address.locality', 'age_over_18', 'family_name', 'given_name']);
});

test('presentation reveals only chosen claims and binds the key', () => {
  const p = parseSdJwt(demo());
  const vp = present(p, [['age_over_18'], ['address', 'locality']], base64UrlToBytes(holder.privateKey), {
    aud: 'x509_san_dns:verifier.example',
    nonce: 'n-0S6_WzA2Mj',
  });
  const back = parseSdJwt(vp);
  expect(back.claims).toEqual(expect.objectContaining({ age_over_18: true, address: { locality: 'Ljubljana' } }));
  expect(back.claims.given_name).toBeUndefined();
  const kb = back.keyBindingJwt!;
  const kbPayload = base64UrlDecodeJson<Record<string, string>>(kb.split('.')[1]);
  const sdPart = vp.slice(0, vp.length - kb.length);
  expect(kbPayload.sd_hash).toBe(createHash('sha256').update(sdPart).digest('base64url'));
  expect(kbPayload.nonce).toBe('n-0S6_WzA2Mj');
});

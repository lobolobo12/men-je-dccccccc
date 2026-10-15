import { expect, test } from '@jest/globals';
import { createPrivateKey, createPublicKey, verify } from 'node:crypto';
import { TEST_CERT_B64, TEST_CERT_KEY_PEM } from '../lib/__fixtures__/cert';
import { decodeCbor, EmbeddedCbor, encodeCbor, get } from '../lib/cbor';
import { generateHolderKey } from '../lib/crypto';
import { base64ToBytes, base64UrlToBytes } from '../lib/encoding';
import { buildDeviceResponse, issueTestMdoc, listMdocClaims, openId4VpSessionTranscript, parseIssuerSigned, verifyIssuerSignature } from './mdoc';

const issuerD = createPrivateKey(TEST_CERT_KEY_PEM).export({ format: 'jwk' }).d!;
const holder = generateHolderKey();
const ns = 'org.iso.18013.5.1';

function issue() {
  return issueTestMdoc({
    docType: 'org.iso.18013.5.1.mDL',
    nameSpaces: { [ns]: { family_name: 'Novak', given_name: 'Ana', age_over_18: true } },
    issuerSecret: base64UrlToBytes(issuerD),
    issuerCertDer: base64ToBytes(TEST_CERT_B64),
    deviceKey: holder.publicJwk,
  });
}

test('parses issuer-signed mdoc, checks digests and issuer signature', () => {
  const m = parseIssuerSigned(issue());
  expect(m.docType).toBe('org.iso.18013.5.1.mDL');
  expect(m.digestsValid).toBe(true);
  expect(verifyIssuerSignature(m)).toBe(true);
  expect(m.issuerCertificate?.subject.CN).toBe('Verifier Test');
  expect(listMdocClaims(m).map((c) => c.path[1])).toEqual(['family_name', 'given_name', 'age_over_18']);
});

test('device response contains only selected elements and a valid device signature', () => {
  const m = parseIssuerSigned(issue());
  const st = openId4VpSessionTranscript({ clientId: 'x509_san_dns:verifier.example', nonce: 'abc', responseUri: 'https://verifier.example/post' });
  const resp = decodeCbor(base64UrlToBytes(buildDeviceResponse(m, [[ns, 'age_over_18']], base64UrlToBytes(holder.privateKey), st)));
  const doc = (get(resp, 'documents') as unknown[])[0];
  const items = get(get(get(doc, 'issuerSigned'), 'nameSpaces'), ns) as EmbeddedCbor[];
  expect(items.map((i) => get(i.decode(), 'elementIdentifier'))).toEqual(['age_over_18']);

  const [prot, , payload, sig] = get(get(get(doc, 'deviceSigned'), 'deviceAuth'), 'deviceSignature') as [Uint8Array, unknown, null, Uint8Array];
  expect(payload).toBeNull();
  const detached = encodeCbor(EmbeddedCbor.of(['DeviceAuthentication', st, 'org.iso.18013.5.1.mDL', get(get(doc, 'deviceSigned'), 'nameSpaces')]));
  const toBeSigned = encodeCbor(['Signature1', prot, new Uint8Array(0), detached]);
  const pub = createPublicKey({ key: holder.publicJwk, format: 'jwk' });
  expect(verify('sha256', toBeSigned, { key: pub, dsaEncoding: 'ieee-p1363' }, sig)).toBe(true);
});

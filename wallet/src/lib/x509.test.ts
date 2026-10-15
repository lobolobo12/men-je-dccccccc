import { expect, test } from '@jest/globals';
import { TEST_CERT_B64, TEST_CERT_PUBKEY_HEX } from './__fixtures__/cert';
import { parseCertificate } from './x509';

test('parses subject, SAN and P-256 key from an openssl certificate', () => {
  const c = parseCertificate(TEST_CERT_B64);
  expect(c.subject).toEqual({ CN: 'Verifier Test', O: 'SI Wallet Test', C: 'SI' });
  expect(c.dnsNames).toEqual(['verifier.example']);
  expect(c.uris).toEqual(['https://verifier.example']);
  expect(Buffer.from(c.publicKey!).toString('hex')).toBe(TEST_CERT_PUBKEY_HEX);
  expect(c.notAfter.getTime()).toBeGreaterThan(c.notBefore.getTime());
});

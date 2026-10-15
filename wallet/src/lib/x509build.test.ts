import { expect, test } from '@jest/globals';
import { X509Certificate } from 'node:crypto';
import { generateHolderKey } from './crypto';
import { parseCertificate } from './x509';
import { selfSignedCertificate } from './x509build';

test('self-signed certificate is valid X.509 that Node accepts and verifies', () => {
  const key = generateHolderKey();
  const der = selfSignedCertificate(key, { C: 'SI', O: 'SI Wallet Demo', CN: 'Demo preverjevalec' }, { dnsName: 'demo.si-wallet.invalid' });
  const node = new X509Certificate(Buffer.from(der));
  expect(node.verify(node.publicKey)).toBe(true);
  expect(node.subjectAltName).toBe('DNS:demo.si-wallet.invalid');
  const ours = parseCertificate(der);
  expect(ours.subject).toEqual({ C: 'SI', O: 'SI Wallet Demo', CN: 'Demo preverjevalec' });
  expect(ours.dnsNames).toEqual(['demo.si-wallet.invalid']);
});

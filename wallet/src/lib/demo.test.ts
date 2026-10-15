import { expect, test } from '@jest/globals';
import { makeDemoCredentials } from './demo';

test('demo credentials cover the four v1 kinds in both formats, with valid issuer signatures', () => {
  const creds = makeDemoCredentials();
  expect(creds.map((c) => [c.kind, c.format])).toEqual([
    ['pid', 'dc+sd-jwt'],
    ['mdl', 'mso_mdoc'],
    ['diploma', 'dc+sd-jwt'],
    ['ehic', 'dc+sd-jwt'],
  ]);
  for (const c of creds) {
    expect(c.claims.length).toBeGreaterThan(3);
    expect(c.verification).toMatchObject({ signatureValid: true, integrityValid: true });
  }
});

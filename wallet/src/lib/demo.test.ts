import { expect, test } from '@jest/globals';
import { makeDemoCredentials } from './demo';

test('demo credentials cover the four v1 kinds', () => {
  const creds = makeDemoCredentials();
  expect(creds.map((c) => c.kind)).toEqual(['pid', 'mdl', 'diploma', 'ehic']);
  for (const c of creds) expect(c.claims.length).toBeGreaterThan(3);
});

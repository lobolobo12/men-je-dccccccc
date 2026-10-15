import { expect, test } from '@jest/globals';
import { makeDemoCredentials } from '../lib/demo';
import { startDemoRequest, walletFetch } from './demoVerifier';
import { matchCredentials, requestedPaths, resolveRequest, submitPresentation } from './oid4vp';

test.each(['age', 'car', 'bank'] as const)('demo scenario %s runs the full OpenID4VP flow on device', async (scenario) => {
  const creds = makeDemoCredentials();
  const resolved = await resolveRequest(startDemoRequest(scenario, 'sl'), walletFetch);
  expect(resolved.verifier.authenticated).toBe(true);
  const selections = resolved.queries.map((q) => {
    const [credential] = matchCredentials(q, creds);
    return { query: q, credential, paths: requestedPaths(q, credential).map((r) => r.path) };
  });
  const { body } = await submitPresentation(resolved, selections, walletFetch);
  const received = body.demo_received as Record<string, Record<string, unknown>>;
  if (scenario === 'age') expect(received.pid).toEqual({ age_over_18: true });
  if (scenario === 'car') expect(Object.keys(received.mdl).sort()).toEqual(['document_number', 'driving_privileges', 'expiry_date', 'family_name', 'given_name']);
  if (scenario === 'bank') expect(received.pid).toMatchObject({ given_name: 'Ana', family_name: 'Novak', birthdate: '1995-04-12' });
});

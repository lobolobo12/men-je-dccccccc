// In-process issuer that follows OpenID4VCI 1.0 and checks what the wallet sends.
import { expect, test } from '@jest/globals';
import { createPrivateKey } from 'node:crypto';
import { TEST_CERT_B64, TEST_CERT_KEY_PEM } from '../lib/__fixtures__/cert';
import { base64ToBytes, base64UrlToBytes } from '../lib/encoding';
import { decodeJws, jwkToPoint, verifyJwsEs256 } from './jose';
import { issueTestMdoc } from './mdoc';
import { acceptOffer, resolveOffer, type Fetch } from './oid4vci';
import { issueSdJwtVc } from './sdjwt';

const ISS = 'https://issuer.example';
const issuerSecret = base64UrlToBytes(createPrivateKey(TEST_CERT_KEY_PEM).export({ format: 'jwk' }).d!);

function mockIssuer(opts: { legacyOnly?: boolean; dpop?: boolean } = {}) {
  const seen: { tokenForm?: URLSearchParams; dpop: string[] } = { dpop: [] };
  const fetchFn: Fetch = async (input, init) => {
    const url = String(input);
    const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
      new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
    const h = (init?.headers ?? {}) as Record<string, string>;
    if (h.DPoP) seen.dpop.push(h.DPoP);
    if (url === `${ISS}/offer/1`) {
      return json({
        credential_issuer: ISS,
        credential_configuration_ids: ['pid_sd', 'mdl_mdoc'],
        grants: { 'urn:ietf:params:oauth:grant-type:pre-authorized_code': { 'pre-authorized_code': 'pac', tx_code: { length: 5 } } },
      });
    }
    if (url === `${ISS}/.well-known/openid-credential-issuer`) {
      return json({
        credential_issuer: ISS,
        credential_endpoint: `${ISS}/credential`,
        nonce_endpoint: `${ISS}/nonce`,
        display: [{ name: 'Testni izdajatelj', locale: 'sl' }, { name: 'Test issuer', locale: 'en' }],
        credential_configurations_supported: {
          pid_sd: { format: 'dc+sd-jwt', vct: 'urn:eudi:pid:1' },
          mdl_mdoc: { format: 'mso_mdoc', doctype: 'org.iso.18013.5.1.mDL' },
        },
      });
    }
    if (url === `${ISS}/.well-known/oauth-authorization-server`) {
      return json({ issuer: ISS, token_endpoint: `${ISS}/token`, ...(opts.dpop ? { dpop_signing_alg_values_supported: ['ES256'] } : {}) });
    }
    if (url === `${ISS}/token`) {
      seen.tokenForm = new URLSearchParams(String(init?.body));
      if (opts.dpop && !decodeJws(h.DPoP).payload.nonce) return json({ error: 'use_dpop_nonce' }, 400, { 'DPoP-Nonce': 'dn1' });
      return json({ access_token: 'at', token_type: opts.dpop ? 'DPoP' : 'Bearer' });
    }
    if (url === `${ISS}/nonce`) return json({ c_nonce: 'cn-1' });
    if (url === `${ISS}/credential`) {
      expect(h.Authorization).toBe(opts.dpop ? 'DPoP at' : 'Bearer at');
      const body = JSON.parse(String(init?.body));
      if (opts.legacyOnly && !body.proof) return json({ error: 'invalid_credential_request' }, 400);
      const proofJwt: string = body.proofs?.jwt?.[0] ?? body.proof.jwt;
      const proof = decodeJws(proofJwt);
      expect(proof.header.typ).toBe('openid4vci-proof+jwt');
      expect(proof.payload).toMatchObject({ aud: ISS, nonce: 'cn-1' });
      const jwk = proof.header.jwk as { kty: 'EC'; crv: 'P-256'; x: string; y: string };
      expect(verifyJwsEs256(proof, jwkToPoint(jwk))).toBe(true);
      const id = body.credential_configuration_id ?? (body.doctype ? 'mdl_mdoc' : 'pid_sd');
      const credential =
        id === 'pid_sd'
          ? issueSdJwtVc(issuerSecret, { x5c: [TEST_CERT_B64] }, { iss: ISS, vct: 'urn:eudi:pid:1', iat: 1, exp: 4102444800, cnf: { jwk } }, { given_name: 'Ana' })
          : issueTestMdoc({
              docType: 'org.iso.18013.5.1.mDL',
              nameSpaces: { 'org.iso.18013.5.1': { family_name: 'Novak' } },
              issuerSecret,
              issuerCertDer: base64ToBytes(TEST_CERT_B64),
              deviceKey: jwk,
            });
      return opts.legacyOnly ? json({ credential }) : json({ credentials: [{ credential }] });
    }
    return json({ error: 'not_found', url }, 404);
  };
  return { fetchFn, seen };
}

const OFFER = `openid-credential-offer://?credential_offer_uri=${encodeURIComponent(`${ISS}/offer/1`)}`;

test('pre-authorized flow issues SD-JWT VC and mdoc', async () => {
  const { fetchFn, seen } = mockIssuer();
  const resolved = await resolveOffer(OFFER, fetchFn);
  const issued = await acceptOffer(resolved, { txCode: '12345', locale: 'sl' }, fetchFn);
  expect(seen.tokenForm?.get('tx_code')).toBe('12345');
  expect(issued.map((i) => [i.credential.kind, i.credential.format])).toEqual([
    ['pid', 'dc+sd-jwt'],
    ['mdl', 'mso_mdoc'],
  ]);
  expect(issued[0].credential.issuer.name).toBe('Testni izdajatelj');
  expect(issued.every((i) => i.verification.signatureValid && i.verification.integrityValid)).toBe(true);
});

test('falls back to draft-13 request shape', async () => {
  const { fetchFn } = mockIssuer({ legacyOnly: true });
  const issued = await acceptOffer(await resolveOffer(OFFER, fetchFn), { txCode: '1', locale: 'en' }, fetchFn);
  expect(issued).toHaveLength(2);
});

test('uses DPoP and retries with server nonce', async () => {
  const { fetchFn, seen } = mockIssuer({ dpop: true });
  await acceptOffer(await resolveOffer(OFFER, fetchFn), { locale: 'en' }, fetchFn);
  expect(seen.dpop.length).toBeGreaterThanOrEqual(3);
  expect(decodeJws(seen.dpop[1]).payload.nonce).toBe('dn1');
});

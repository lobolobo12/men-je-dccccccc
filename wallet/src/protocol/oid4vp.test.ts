// In-process verifier following OpenID4VP 1.0: signed request object (x509_san_dns),
// DCQL query, encrypted direct_post.jwt response.
import { expect, test } from '@jest/globals';
import { createPrivateKey } from 'node:crypto';
import { compactDecrypt, exportJWK, generateKeyPair } from 'jose';
import { TEST_CERT_B64, TEST_CERT_KEY_PEM } from '../lib/__fixtures__/cert';
import { decodeCbor, get } from '../lib/cbor';
import { generateHolderKey, signJwt } from '../lib/crypto';
import { base64ToBytes, base64UrlDecodeJson, base64UrlToBytes } from '../lib/encoding';
import { storeCredential } from './credential';
import { issueTestMdoc } from './mdoc';
import type { Fetch } from './oid4vci';
import { matchCredentials, requestedPaths, resolveRequest, submitPresentation } from './oid4vp';
import { issueSdJwtVc, parseSdJwt } from './sdjwt';

const certKey = base64UrlToBytes(createPrivateKey(TEST_CERT_KEY_PEM).export({ format: 'jwk' }).d!);
const VER = 'https://verifier.example';

function wallet() {
  const pidKey = generateHolderKey();
  const mdlKey = generateHolderKey();
  const pid = storeCredential(
    'dc+sd-jwt',
    issueSdJwtVc(certKey, { x5c: [TEST_CERT_B64] }, { iss: 'https://i', vct: 'urn:eudi:pid:1', cnf: { jwk: pidKey.publicJwk } }, {
      given_name: 'Ana',
      family_name: 'Novak',
      age_over_18: true,
    }),
    pidKey,
    { id: 'https://i' },
  ).credential;
  const mdl = storeCredential(
    'mso_mdoc',
    issueTestMdoc({
      docType: 'org.iso.18013.5.1.mDL',
      nameSpaces: { 'org.iso.18013.5.1': { family_name: 'Novak', document_number: 'X1' } },
      issuerSecret: certKey,
      issuerCertDer: base64ToBytes(TEST_CERT_B64),
      deviceKey: mdlKey.publicJwk,
    }),
    mdlKey,
    { id: 'https://i' },
  ).credential;
  return [pid, mdl];
}

async function verifier(requestPayload: Record<string, unknown>, clientId = 'x509_san_dns:verifier.example') {
  const posted: { form?: URLSearchParams } = {};
  const jwt = signJwt(certKey, { typ: 'oauth-authz-req+jwt', x5c: [TEST_CERT_B64] }, { client_id: clientId, ...requestPayload });
  const fetchFn: Fetch = async (input, init) => {
    const url = String(input);
    if (url === `${VER}/request/1`) return new Response(jwt, { headers: { 'Content-Type': 'application/oauth-authz-req+jwt' } });
    if (url === `${VER}/post`) {
      posted.form = new URLSearchParams(String(init?.body));
      return new Response(JSON.stringify({ redirect_uri: `${VER}/done` }), { headers: { 'Content-Type': 'application/json' } });
    }
    return new Response('not found', { status: 404 });
  };
  const link = `openid4vp://?client_id=${encodeURIComponent(clientId)}&request_uri=${encodeURIComponent(`${VER}/request/1`)}`;
  return { fetchFn, posted, link };
}

test('DCQL request with encrypted response', async () => {
  const [pid, mdl] = wallet();
  const { publicKey, privateKey } = await generateKeyPair('ECDH-ES', { crv: 'P-256', extractable: true });
  const encJwk = { ...(await exportJWK(publicKey)), kid: 'enc-1', use: 'enc' };
  const { fetchFn, posted, link } = await verifier({
    response_type: 'vp_token',
    response_mode: 'direct_post.jwt',
    response_uri: `${VER}/post`,
    nonce: 'nonce-123',
    state: 'st',
    client_metadata: { jwks: { keys: [encJwk] }, encrypted_response_enc_values_supported: ['A128GCM'] },
    dcql_query: {
      credentials: [
        { id: 'pid', format: 'dc+sd-jwt', meta: { vct_values: ['urn:eudi:pid:1'] }, claims: [{ path: ['age_over_18'] }] },
        { id: 'mdl', format: 'mso_mdoc', meta: { doctype_value: 'org.iso.18013.5.1.mDL' }, claims: [{ path: ['org.iso.18013.5.1', 'family_name'] }] },
      ],
    },
  });

  const resolved = await resolveRequest(link, fetchFn);
  expect(resolved.verifier).toMatchObject({ authenticated: true, name: 'SI Wallet Test' });
  const selections = resolved.queries.map((q) => {
    const [credential] = matchCredentials(q, [pid, mdl]);
    return { query: q, credential, paths: requestedPaths(q, credential).map((r) => r.path) };
  });
  expect(selections.map((s) => s.credential.id)).toEqual([pid.id, mdl.id]);

  const result = await submitPresentation(resolved, selections, fetchFn);
  expect(result.redirectUri).toBe(`${VER}/done`);

  const { plaintext } = await compactDecrypt(posted.form!.get('response')!, privateKey);
  const body = JSON.parse(new TextDecoder().decode(plaintext));
  expect(body.state).toBe('st');

  const sd = parseSdJwt(body.vp_token.pid[0]);
  expect(sd.claims.age_over_18).toBe(true);
  expect(sd.claims.given_name).toBeUndefined();
  const kb = base64UrlDecodeJson<Record<string, unknown>>(sd.keyBindingJwt!.split('.')[1]);
  expect(kb).toMatchObject({ aud: 'x509_san_dns:verifier.example', nonce: 'nonce-123' });

  const dr = decodeCbor(base64UrlToBytes(body.vp_token.mdl[0]));
  const doc = (get(dr, 'documents') as unknown[])[0];
  expect(get(doc, 'docType')).toBe('org.iso.18013.5.1.mDL');
});

test('unsigned or mismatched requests are not authenticated', async () => {
  const { fetchFn, link } = await verifier(
    { response_uri: `${VER}/post`, response_mode: 'direct_post', nonce: 'n', dcql_query: { credentials: [{ id: 'a', format: 'dc+sd-jwt' }] } },
    'x509_san_dns:evil.example',
  );
  const resolved = await resolveRequest(link, fetchFn);
  expect(resolved.verifier.authenticated).toBe(false);
});

test('legacy presentation_definition with plain direct_post', async () => {
  const [pid] = wallet();
  const { fetchFn, posted, link } = await verifier({
    response_type: 'vp_token',
    response_mode: 'direct_post',
    response_uri: `${VER}/post`,
    nonce: 'n2',
    presentation_definition: {
      id: 'pd1',
      input_descriptors: [
        {
          id: 'pid',
          format: { 'vc+sd-jwt': {} },
          constraints: { fields: [{ path: ['$.vct'], filter: { const: 'urn:eudi:pid:1' } }, { path: ['$.family_name'] }] },
        },
      ],
    },
  });
  const resolved = await resolveRequest(link, fetchFn);
  expect(resolved.mode).toBe('pe');
  const q = resolved.queries[0];
  const [credential] = matchCredentials(q, [pid]);
  await submitPresentation(resolved, [{ query: q, credential, paths: requestedPaths(q, credential).map((r) => r.path) }], fetchFn);
  const sub = JSON.parse(posted.form!.get('presentation_submission')!);
  expect(sub).toMatchObject({ definition_id: 'pd1', descriptor_map: [{ id: 'pid', path: '$' }] });
  expect(parseSdJwt(posted.form!.get('vp_token')!).claims).toEqual(expect.objectContaining({ family_name: 'Novak' }));
});

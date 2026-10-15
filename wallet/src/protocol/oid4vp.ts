// OpenID for Verifiable Presentations (1.0) wallet side: fetch and authenticate the request,
// match DCQL (or legacy Presentation Exchange) queries to stored credentials, and respond via
// direct_post or direct_post.jwt. Supports SD-JWT VC and ISO mdoc.
import { randomBytes, sha256 } from '../lib/crypto';
import { base64UrlToBytes, bytesToBase64Url } from '../lib/encoding';
import type { StoredCredential } from '../lib/types';
import { parseCertificate, type Certificate } from '../lib/x509';
import { decodeJws, encryptJwe, jwkThumbprint, verifyJwsEs256, type EncryptionJwk } from './jose';
import { buildDeviceResponse, iso180137SessionTranscript, openId4VpSessionTranscript, parseIssuerSigned } from './mdoc';
import { parseSdJwt, present } from './sdjwt';
import type { Fetch } from './oid4vci';

export class PresentationError extends Error {}

type Dcql = {
  credentials: {
    id: string;
    format: string;
    multiple?: boolean;
    meta?: { vct_values?: string[]; doctype_value?: string };
    claims?: { id?: string; path?: (string | number | null)[]; namespace?: string; claim_name?: string }[];
  }[];
  credential_sets?: { options: string[][]; required?: boolean }[];
};

type PresentationDefinition = {
  id: string;
  input_descriptors: {
    id: string;
    format?: Record<string, unknown>;
    constraints?: { fields?: { path: string[]; filter?: { const?: string; pattern?: string }; optional?: boolean }[] };
  }[];
};

export type AuthorizationRequest = {
  client_id: string;
  response_type?: string;
  response_mode?: string;
  response_uri?: string;
  redirect_uri?: string;
  nonce: string;
  state?: string;
  dcql_query?: Dcql;
  presentation_definition?: PresentationDefinition;
  client_metadata?: {
    client_name?: string;
    logo_uri?: string;
    jwks?: { keys: EncryptionJwk[] };
    encrypted_response_enc_values_supported?: string[];
    authorization_encrypted_response_enc?: string;
  };
  [k: string]: unknown;
};

export type VerifierIdentity = {
  clientId: string;
  name: string;
  /** Request signature checked and certificate matches the client identifier. */
  authenticated: boolean;
  certificate?: Certificate;
};

/** One credential the verifier needs, with the claim paths it asks for. */
export type CredentialQuery = {
  id: string;
  format: 'dc+sd-jwt' | 'mso_mdoc';
  types: string[];
  /** Empty means the verifier did not restrict claims (all are requested). */
  claims: { path: string[]; optional: boolean }[];
  optional: boolean;
};

export type ResolvedRequest = {
  request: AuthorizationRequest;
  verifier: VerifierIdentity;
  queries: CredentialQuery[];
  mode: 'dcql' | 'pe';
};

function queryParams(uri: string): URLSearchParams {
  return new URLSearchParams(uri.slice(uri.indexOf('?') + 1));
}

function authenticate(req: AuthorizationRequest, jwsHeader: Record<string, unknown> | null, signatureOk: boolean): VerifierIdentity {
  const x5c = jwsHeader?.x5c as string[] | undefined;
  const certificate = x5c?.length ? parseCertificate(x5c[0]) : undefined;
  const clientId = req.client_id;
  const [prefix, ...rest] = clientId.split(':');
  const value = rest.join(':');
  let matches = false;
  if (certificate && signatureOk) {
    if (prefix === 'x509_san_dns') matches = certificate.dnsNames.includes(value);
    else if (prefix === 'x509_hash') matches = bytesToBase64Url(sha256(certificate.der)) === value;
  }
  const name =
    req.client_metadata?.client_name ?? certificate?.subject.O ?? certificate?.subject.CN ?? (value || clientId);
  return { clientId, name, authenticated: matches, certificate };
}

function jsonPathToPath(p: string): string[] {
  // $.a.b, $['ns']['el'], $.a[0]
  const out: string[] = [];
  const re = /\['([^']+)'\]|\["([^"]+)"\]|\.([A-Za-z0-9_\-]+)|\[(\d+|\*)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(p))) out.push(m[1] ?? m[2] ?? m[3] ?? m[4]);
  return out;
}

export function queriesFromDcql(dcql: Dcql): CredentialQuery[] {
  const requiredIds = new Set<string>();
  const optionalIds = new Set<string>();
  if (dcql.credential_sets?.length) {
    for (const set of dcql.credential_sets) {
      // The holder picks one option per set; v1 takes the first option as the default.
      for (const id of set.options[0] ?? []) (set.required === false ? optionalIds : requiredIds).add(id);
    }
  } else {
    for (const c of dcql.credentials) requiredIds.add(c.id);
  }
  return dcql.credentials
    .filter((c) => requiredIds.has(c.id) || optionalIds.has(c.id))
    .map((c) => {
      const format = c.format === 'mso_mdoc' ? 'mso_mdoc' : 'dc+sd-jwt';
      const types = format === 'mso_mdoc' ? (c.meta?.doctype_value ? [c.meta.doctype_value] : []) : (c.meta?.vct_values ?? []);
      const claims = (c.claims ?? []).map((cl) => {
        const raw = cl.path ?? [cl.namespace ?? '', cl.claim_name ?? ''];
        const cut = raw.indexOf(null);
        const path = (cut >= 0 ? raw.slice(0, cut) : raw).map(String);
        return { path, optional: false };
      });
      return { id: c.id, format, types, claims, optional: !requiredIds.has(c.id) };
    });
}

export function queriesFromPresentationDefinition(pd: PresentationDefinition): CredentialQuery[] {
  return pd.input_descriptors.map((d) => {
    const isMdoc = Boolean(d.format?.mso_mdoc) || /^[a-z]+(\.[a-z0-9]+)+$/i.test(d.id);
    const fields = d.constraints?.fields ?? [];
    const typeField = fields.find((f) => f.path.some((p) => /vct|\btype\b/.test(p)) && f.filter);
    const types = isMdoc ? [d.id] : typeField?.filter?.const ? [typeField.filter.const] : [];
    const claims = fields
      .filter((f) => f !== typeField)
      .map((f) => ({ path: jsonPathToPath(f.path[0]).filter((s) => s !== '*'), optional: Boolean(f.optional) }))
      .filter((c) => c.path.length > 0);
    return { id: d.id, format: isMdoc ? 'mso_mdoc' : 'dc+sd-jwt', types, claims, optional: false } as CredentialQuery;
  });
}

export async function resolveRequest(uri: string, fetchFn: Fetch = fetch): Promise<ResolvedRequest> {
  const params = queryParams(uri);
  let jwt = params.get('request');
  const requestUri = params.get('request_uri');
  if (!jwt && requestUri) {
    const post = params.get('request_uri_method') === 'post';
    const res = post
      ? await fetchFn(requestUri, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/oauth-authz-req+jwt' },
          body: new URLSearchParams({
            wallet_metadata: JSON.stringify({
              vp_formats_supported: { 'dc+sd-jwt': { 'sd-jwt_alg_values': ['ES256'], 'kb-jwt_alg_values': ['ES256'] }, mso_mdoc: {} },
            }),
          }).toString(),
        })
      : await fetchFn(requestUri, { headers: { Accept: 'application/oauth-authz-req+jwt' } });
    if (!res.ok) throw new PresentationError(`request_uri → ${res.status}`);
    jwt = (await res.text()).trim();
  }

  let request: AuthorizationRequest;
  let identity: VerifierIdentity;
  if (jwt) {
    const jws = decodeJws(jwt);
    const x5c = jws.header.x5c as string[] | undefined;
    const key = x5c?.length ? parseCertificate(x5c[0]).publicKey : undefined;
    const signatureOk = key ? verifyJwsEs256(jws, key) : false;
    request = jws.payload as AuthorizationRequest;
    const outer = params.get('client_id');
    if (outer && request.client_id !== outer) throw new PresentationError('client_id mismatch between link and request');
    identity = authenticate(request, jws.header, signatureOk);
  } else {
    request = Object.fromEntries(params.entries()) as unknown as AuthorizationRequest;
    for (const k of ['dcql_query', 'presentation_definition', 'client_metadata'] as const) {
      const v = params.get(k);
      if (v) (request as Record<string, unknown>)[k] = JSON.parse(v);
    }
    identity = authenticate(request, null, false);
  }

  if (!request.nonce) throw new PresentationError('Request has no nonce');
  if (request.response_type && !request.response_type.split(' ').includes('vp_token')) {
    throw new PresentationError(`Unsupported response_type ${request.response_type}`);
  }
  const mode = request.dcql_query ? 'dcql' : 'pe';
  const queries = request.dcql_query
    ? queriesFromDcql(request.dcql_query)
    : request.presentation_definition
      ? queriesFromPresentationDefinition(request.presentation_definition)
      : [];
  if (!queries.length) throw new PresentationError('Request has no dcql_query or presentation_definition');
  return { request, verifier: identity, queries, mode };
}

/** Claim paths of `credential` that satisfy `query` (all of them when the query lists none). */
export function requestedPaths(query: CredentialQuery, credential: StoredCredential): { path: string[]; optional: boolean }[] {
  const has = (p: string[]) => credential.claims.some((c) => p.every((s, i) => c.path[i] === s));
  if (!query.claims.length) return credential.claims.filter((c) => c.selectable).map((c) => ({ path: c.path, optional: false }));
  return query.claims.filter((q) => has(q.path));
}

export function matchCredentials(query: CredentialQuery, credentials: StoredCredential[]): StoredCredential[] {
  return credentials.filter(
    (c) =>
      c.format === query.format &&
      (query.types.length === 0 || query.types.includes(c.type)) &&
      query.claims.filter((q) => !q.optional).every((q) => c.claims.some((cl) => q.path.every((s, i) => cl.path[i] === s))),
  );
}

export type Selection = { query: CredentialQuery; credential: StoredCredential; paths: string[][] };

export async function submitPresentation(
  resolved: ResolvedRequest,
  selections: Selection[],
  fetchFn: Fetch = fetch,
): Promise<{ redirectUri?: string }> {
  const { request, mode } = resolved;
  const responseUri = request.response_uri ?? request.redirect_uri;
  if (!responseUri) throw new PresentationError('Request has no response_uri');
  const encrypted = request.response_mode === 'direct_post.jwt';
  const encKey = encrypted
    ? request.client_metadata?.jwks?.keys.find((k) => k.kty === 'EC' && (k.use === 'enc' || !k.use))
    : undefined;
  if (encrypted && !encKey) throw new PresentationError('No encryption key in client_metadata');
  const mdocGeneratedNonce = bytesToBase64Url(randomBytes(16));

  const presentations = selections.map(({ credential, paths }) => {
    const secret = base64UrlToBytes(credential.holderKey.privateKey);
    if (credential.format === 'mso_mdoc') {
      const transcript =
        mode === 'dcql'
          ? openId4VpSessionTranscript({
              clientId: request.client_id,
              nonce: request.nonce,
              responseUri,
              jwkThumbprint: encKey ? jwkThumbprint(encKey) : null,
            })
          : iso180137SessionTranscript({ clientId: request.client_id, nonce: request.nonce, responseUri, mdocGeneratedNonce });
      return buildDeviceResponse(parseIssuerSigned(credential.raw), paths, secret, transcript);
    }
    return present(parseSdJwt(credential.raw), paths, secret, { aud: request.client_id, nonce: request.nonce });
  });

  const body: Record<string, unknown> = {};
  if (mode === 'dcql') {
    body.vp_token = Object.fromEntries(selections.map((s, i) => [s.query.id, [presentations[i]]]));
  } else {
    body.vp_token = presentations.length === 1 ? presentations[0] : presentations;
    body.presentation_submission = {
      id: bytesToBase64Url(randomBytes(8)),
      definition_id: request.presentation_definition!.id,
      descriptor_map: selections.map((s, i) => ({
        id: s.query.id,
        format: s.credential.format === 'mso_mdoc' ? 'mso_mdoc' : 'vc+sd-jwt',
        path: presentations.length === 1 ? '$' : `$[${i}]`,
      })),
    };
  }
  if (request.state) body.state = request.state;

  const form = new URLSearchParams();
  if (encKey) {
    const enc =
      (request.client_metadata?.encrypted_response_enc_values_supported?.[0] ??
        request.client_metadata?.authorization_encrypted_response_enc ??
        'A128GCM') === 'A256GCM'
        ? 'A256GCM'
        : 'A128GCM';
    const jwe = encryptJwe(body, encKey, {
      enc,
      ...(mode === 'pe'
        ? { apu: new TextEncoder().encode(mdocGeneratedNonce), apv: new TextEncoder().encode(request.nonce) }
        : {}),
    });
    form.set('response', jwe);
  } else {
    for (const [k, v] of Object.entries(body)) form.set(k, typeof v === 'string' ? v : JSON.stringify(v));
  }

  const res = await fetchFn(responseUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: form.toString(),
  });
  if (!res.ok) throw new PresentationError(`response_uri → ${res.status} ${await res.text().catch(() => '')}`.trim());
  const json = (await res.json().catch(() => ({}))) as { redirect_uri?: string };
  return { redirectUri: json.redirect_uri };
}

export async function declinePresentation(resolved: ResolvedRequest, fetchFn: Fetch = fetch): Promise<void> {
  const uri = resolved.request.response_uri;
  if (!uri) return;
  const form = new URLSearchParams({ error: 'access_denied', error_description: 'User declined' });
  if (resolved.request.state) form.set('state', resolved.request.state);
  await fetchFn(uri, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form.toString() }).catch(
    () => undefined,
  );
}

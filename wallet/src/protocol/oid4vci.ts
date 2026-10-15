// OpenID for Verifiable Credential Issuance (1.0) wallet client, pre-authorized code flow.
// Falls back to draft-13 request shapes for issuers that have not moved to 1.0 yet.
import { generateHolderKey, signJwt, type HolderKey } from '../lib/crypto';
import { base64UrlToBytes } from '../lib/encoding';
import { storeCredential, type Verification } from './credential';
import { dpopProof } from './jose';
import type { StoredCredential } from '../lib/types';

export type Fetch = typeof fetch;

export const PRE_AUTH_GRANT = 'urn:ietf:params:oauth:grant-type:pre-authorized_code';

export type CredentialOffer = {
  credential_issuer: string;
  credential_configuration_ids: string[];
  grants?: {
    [PRE_AUTH_GRANT]?: {
      'pre-authorized_code': string;
      tx_code?: { length?: number; input_mode?: 'numeric' | 'text'; description?: string };
      authorization_server?: string;
    };
    authorization_code?: { issuer_state?: string; authorization_server?: string };
  };
};

type Display = { name?: string; locale?: string };

export type CredentialConfiguration = {
  format: string;
  vct?: string;
  doctype?: string;
  scope?: string;
  proof_types_supported?: Record<string, { proof_signing_alg_values_supported?: string[] }>;
  display?: Display[];
  credential_metadata?: { display?: Display[] };
};

export type IssuerMetadata = {
  credential_issuer: string;
  credential_endpoint: string;
  nonce_endpoint?: string;
  authorization_servers?: string[];
  display?: Display[];
  credential_configurations_supported: Record<string, CredentialConfiguration>;
};

export type AuthServerMetadata = {
  issuer?: string;
  token_endpoint: string;
  dpop_signing_alg_values_supported?: string[];
  pre_authorized_grant_anonymous_access_supported?: boolean;
};

export type ResolvedOffer = {
  offer: CredentialOffer;
  issuer: IssuerMetadata;
  authServer: AuthServerMetadata;
};

export class IssuanceError extends Error {}

async function getJson<T>(fetchFn: Fetch, url: string): Promise<T> {
  const res = await fetchFn(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new IssuanceError(`GET ${url} → ${res.status}`);
  return (await res.json()) as T;
}

/** RFC 8615 well-known location; for URLs with a path the suffix goes between host and path. */
export function wellKnown(base: string, suffix: string): string[] {
  const u = new URL(base);
  const path = u.pathname.replace(/\/$/, '');
  const inserted = `${u.origin}/.well-known/${suffix}${path}`;
  const appended = `${u.origin}${path}/.well-known/${suffix}`;
  return path ? [inserted, appended] : [inserted];
}

async function firstJson<T>(fetchFn: Fetch, urls: string[]): Promise<T> {
  let last: unknown;
  for (const url of urls) {
    try {
      return await getJson<T>(fetchFn, url);
    } catch (e) {
      last = e;
    }
  }
  throw last;
}

export function parseOfferUri(uri: string): { offer?: CredentialOffer; offerUri?: string } {
  const q = uri.slice(uri.indexOf('?') + 1);
  const params = new URLSearchParams(q);
  const inline = params.get('credential_offer');
  if (inline) return { offer: JSON.parse(inline) as CredentialOffer };
  const ref = params.get('credential_offer_uri');
  if (ref) return { offerUri: ref };
  throw new IssuanceError('No credential_offer in link');
}

export async function resolveOffer(uri: string, fetchFn: Fetch = fetch): Promise<ResolvedOffer> {
  const parsed = parseOfferUri(uri);
  const offer = parsed.offer ?? (await getJson<CredentialOffer>(fetchFn, parsed.offerUri!));
  const issuer = await firstJson<IssuerMetadata>(fetchFn, wellKnown(offer.credential_issuer, 'openid-credential-issuer'));
  const asBase =
    offer.grants?.[PRE_AUTH_GRANT]?.authorization_server ?? issuer.authorization_servers?.[0] ?? issuer.credential_issuer;
  const authServer = await firstJson<AuthServerMetadata>(fetchFn, [
    ...wellKnown(asBase, 'oauth-authorization-server'),
    ...wellKnown(asBase, 'openid-configuration'),
  ]);
  return { offer, issuer, authServer };
}

export function displayName(displays: Display[] | undefined, locale: string): string | undefined {
  if (!displays?.length) return undefined;
  return (displays.find((d) => d.locale?.toLowerCase().startsWith(locale)) ?? displays.find((d) => d.locale?.startsWith('en')) ?? displays[0]).name;
}

export function configurationName(cfg: CredentialConfiguration | undefined, id: string, locale: string): string {
  return displayName(cfg?.credential_metadata?.display ?? cfg?.display, locale) ?? cfg?.vct ?? cfg?.doctype ?? id;
}

type Token = { access_token: string; token_type?: string; c_nonce?: string };

/** POST with optional DPoP, retrying once when the server asks for a DPoP nonce. */
async function post(
  fetchFn: Fetch,
  url: string,
  body: string,
  contentType: string,
  dpopKey: HolderKey | null,
  accessToken?: string,
  tokenType?: string,
): Promise<Response> {
  let nonce: string | undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    const headers: Record<string, string> = { 'Content-Type': contentType, Accept: 'application/json' };
    if (dpopKey) headers.DPoP = dpopProof(dpopKey, 'POST', url, { nonce, accessToken });
    if (accessToken) headers.Authorization = `${dpopKey && tokenType?.toLowerCase() === 'dpop' ? 'DPoP' : 'Bearer'} ${accessToken}`;
    const res = await fetchFn(url, { method: 'POST', headers, body });
    const serverNonce = res.headers.get('DPoP-Nonce');
    if (dpopKey && serverNonce && serverNonce !== nonce && (res.status === 400 || res.status === 401) && attempt === 0) {
      nonce = serverNonce;
      continue;
    }
    return res;
  }
  throw new IssuanceError('unreachable');
}

async function errorText(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: string; error_description?: string };
    return [j.error, j.error_description].filter(Boolean).join(': ') || String(res.status);
  } catch {
    return String(res.status);
  }
}

export type IssuedCredential = { credential: StoredCredential; verification: Verification };

export async function acceptOffer(
  resolved: ResolvedOffer,
  opts: { txCode?: string; locale: string },
  fetchFn: Fetch = fetch,
): Promise<IssuedCredential[]> {
  const { offer, issuer, authServer } = resolved;
  const grant = offer.grants?.[PRE_AUTH_GRANT];
  if (!grant) throw new IssuanceError('authorization_code_unsupported');

  const useDpop = authServer.dpop_signing_alg_values_supported?.includes('ES256') ?? false;
  const dpopKey = useDpop ? generateHolderKey() : null;

  const form = new URLSearchParams({ grant_type: PRE_AUTH_GRANT, 'pre-authorized_code': grant['pre-authorized_code'] });
  if (opts.txCode) form.set('tx_code', opts.txCode);
  const tokenRes = await post(fetchFn, authServer.token_endpoint, form.toString(), 'application/x-www-form-urlencoded', dpopKey);
  if (!tokenRes.ok) throw new IssuanceError(`token: ${await errorText(tokenRes)}`);
  const token = (await tokenRes.json()) as Token;

  const freshNonce = async (): Promise<string | undefined> => {
    if (!issuer.nonce_endpoint) return token.c_nonce;
    const r = await fetchFn(issuer.nonce_endpoint, { method: 'POST' });
    if (!r.ok) throw new IssuanceError(`nonce: ${r.status}`);
    return ((await r.json()) as { c_nonce: string }).c_nonce;
  };

  const issuerName = displayName(issuer.display, opts.locale);
  const results: IssuedCredential[] = [];
  for (const configId of offer.credential_configuration_ids) {
    const cfg = issuer.credential_configurations_supported[configId];
    if (!cfg) throw new IssuanceError(`Unknown credential configuration ${configId}`);
    const holderKey = generateHolderKey();
    const proofFor = (nonce: string | undefined) =>
      signJwt(
        base64UrlToBytes(holderKey.privateKey),
        { typ: 'openid4vci-proof+jwt', jwk: holderKey.publicJwk },
        { aud: issuer.credential_issuer, iat: Math.floor(Date.now() / 1000), ...(nonce ? { nonce } : {}) },
      );

    const request = async (nonce: string | undefined, legacy: boolean) => {
      const proof = proofFor(nonce);
      const body = legacy
        ? { format: cfg.format, ...(cfg.vct ? { vct: cfg.vct } : {}), ...(cfg.doctype ? { doctype: cfg.doctype } : {}), proof: { proof_type: 'jwt', jwt: proof } }
        : { credential_configuration_id: configId, proofs: { jwt: [proof] } };
      return post(fetchFn, issuer.credential_endpoint, JSON.stringify(body), 'application/json', dpopKey, token.access_token, token.token_type);
    };

    let nonce = await freshNonce();
    let res = await request(nonce, false);
    if (!res.ok) {
      const err = (await res.clone().json().catch(() => ({}))) as { error?: string; c_nonce?: string };
      if (err.error === 'invalid_nonce' || err.error === 'invalid_proof') {
        nonce = err.c_nonce ?? (await freshNonce());
        res = await request(nonce, false);
      } else if (err.error === 'invalid_credential_request' || err.error === 'invalid_request') {
        res = await request(err.c_nonce ?? nonce, true);
      }
    }
    if (!res.ok) throw new IssuanceError(`credential: ${await errorText(res)}`);
    const body = (await res.json()) as {
      credentials?: { credential: string }[];
      credential?: string;
      transaction_id?: string;
    };
    const raw = body.credentials?.[0]?.credential ?? body.credential;
    if (!raw) throw new IssuanceError(body.transaction_id ? 'deferred_unsupported' : 'No credential in response');
    results.push(storeCredential(cfg.format, raw, holderKey, { id: issuer.credential_issuer, name: issuerName }));
  }
  return results;
}

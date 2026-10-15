// A relying party that runs inside the app, so the full OpenID4VP flow (signed request object,
// certificate check, DCQL matching, consent, selective disclosure, key binding) can be tried
// without a website. Traffic to DEMO_HOST never leaves the device: walletFetch answers it.
import { EmbeddedCbor, decodeCbor, get, toPlain } from '../lib/cbor';
import { generateHolderKey, randomId, signJwt } from '../lib/crypto';
import { base64UrlDecodeJson, base64UrlToBytes, bytesToBase64 } from '../lib/encoding';
import { selfSignedCertificate } from '../lib/x509build';
import { parseSdJwt } from './sdjwt';

export const DEMO_HOST = 'demo.si-wallet.invalid';
const BASE = `https://${DEMO_HOST}`;
const CLIENT_ID = `x509_san_dns:${DEMO_HOST}`;

export type DemoScenario = 'age' | 'car' | 'bank';

const PID = 'urn:eudi:pid:1';
const MDL = 'org.iso.18013.5.1.mDL';
const NS = 'org.iso.18013.5.1';

const SCENARIOS: Record<DemoScenario, { name: Record<'sl' | 'en', string>; dcql: unknown }> = {
  age: {
    name: { sl: 'Spletna trgovina (DEMO)', en: 'Online shop (DEMO)' },
    dcql: { credentials: [{ id: 'pid', format: 'dc+sd-jwt', meta: { vct_values: [PID] }, claims: [{ path: ['age_over_18'] }] }] },
  },
  car: {
    name: { sl: 'Najem avtomobila (DEMO)', en: 'Car rental (DEMO)' },
    dcql: {
      credentials: [
        {
          id: 'mdl',
          format: 'mso_mdoc',
          meta: { doctype_value: MDL },
          claims: [
            { path: [NS, 'given_name'] },
            { path: [NS, 'family_name'] },
            { path: [NS, 'document_number'] },
            { path: [NS, 'driving_privileges'] },
            { path: [NS, 'expiry_date'] },
          ],
        },
      ],
    },
  },
  bank: {
    name: { sl: 'Odprtje bančnega računa (DEMO)', en: 'Opening a bank account (DEMO)' },
    dcql: {
      credentials: [
        {
          id: 'pid',
          format: 'dc+sd-jwt',
          meta: { vct_values: [PID] },
          claims: [{ path: ['given_name'] }, { path: ['family_name'] }, { path: ['birthdate'] }, { path: ['address'] }],
        },
      ],
    },
  },
};

type Session = { requestJwt: string; nonce: string; state: string };
const sessions = new Map<string, Session>();
let verifierKey: ReturnType<typeof generateHolderKey> | null = null;
let verifierCert: Uint8Array | null = null;

function identity() {
  if (!verifierKey || !verifierCert) {
    verifierKey = generateHolderKey();
    verifierCert = selfSignedCertificate(verifierKey, { C: 'SI', O: 'SI Wallet DEMO', CN: 'Demo preverjevalec' }, { dnsName: DEMO_HOST });
  }
  return { key: verifierKey, cert: verifierCert };
}

/** Creates a presentation request and returns the link the wallet would get from a QR code. */
export function startDemoRequest(scenario: DemoScenario, locale: 'sl' | 'en'): string {
  const { key, cert } = identity();
  const id = randomId();
  const nonce = randomId();
  const state = randomId();
  const s = SCENARIOS[scenario];
  const requestJwt = signJwt(
    base64UrlToBytes(key.privateKey),
    { typ: 'oauth-authz-req+jwt', x5c: [bytesToBase64(cert)] },
    {
      client_id: CLIENT_ID,
      response_type: 'vp_token',
      response_mode: 'direct_post',
      response_uri: `${BASE}/response/${id}`,
      nonce,
      state,
      dcql_query: s.dcql,
      client_metadata: { client_name: s.name[locale] },
    },
  );
  sessions.set(id, { requestJwt, nonce, state });
  return `openid4vp://?client_id=${encodeURIComponent(CLIENT_ID)}&request_uri=${encodeURIComponent(`${BASE}/request/${id}`)}`;
}

/** What the demo verifier extracted from the presentation, shown back to the user. */
function readPresentation(token: string): Record<string, unknown> {
  if (token.includes('~')) {
    const p = parseSdJwt(token);
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(p.claims)) {
      if (!['iss', 'iat', 'exp', 'cnf', 'vct', 'status', '_sd_alg'].includes(k)) out[k] = v;
    }
    return out;
  }
  const response = decodeCbor(base64UrlToBytes(token));
  const doc = (get(response, 'documents') as unknown[])[0];
  const out: Record<string, unknown> = {};
  const namespaces = get(get(doc, 'issuerSigned'), 'nameSpaces') as Map<string, EmbeddedCbor[]>;
  for (const items of namespaces.values()) {
    for (const item of items) {
      const decoded = item.decode();
      out[get(decoded, 'elementIdentifier') as string] = toPlain(get(decoded, 'elementValue'));
    }
  }
  return out;
}

async function handle(url: URL, init?: RequestInit): Promise<Response> {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const [, kind, id] = url.pathname.split('/');
  const session = sessions.get(id);
  if (!session) return json({ error: 'not_found' }, 404);
  if (kind === 'request') return new Response(session.requestJwt, { headers: { 'Content-Type': 'application/oauth-authz-req+jwt' } });
  if (kind === 'response') {
    const form = new URLSearchParams(String(init?.body ?? ''));
    if (form.get('error')) {
      sessions.delete(id);
      return json({});
    }
    if (form.get('state') !== session.state) return json({ error: 'invalid_state' }, 400);
    const vpToken = JSON.parse(form.get('vp_token') ?? '{}') as Record<string, string[]>;
    const received: Record<string, unknown> = {};
    for (const [queryId, presentations] of Object.entries(vpToken)) {
      const token = presentations[0];
      if (token.includes('~')) {
        const kb = token.slice(token.lastIndexOf('~') + 1).split('.')[1];
        const payload = base64UrlDecodeJson<{ nonce?: string; aud?: string }>(kb);
        if (payload.nonce !== session.nonce || payload.aud !== CLIENT_ID) return json({ error: 'invalid_key_binding' }, 400);
      }
      received[queryId] = readPresentation(token);
    }
    sessions.delete(id);
    return json({ demo_received: received });
  }
  return json({ error: 'not_found' }, 404);
}

/** fetch() for the wallet: requests to the demo host are answered on the device. */
export const walletFetch: typeof fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
  if (url.hostname === DEMO_HOST) return handle(url, init);
  return fetch(input, init);
};

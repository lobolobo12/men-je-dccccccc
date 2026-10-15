// ISO/IEC 18013-5 mdoc handling for the holder: parse IssuerSigned, check value digests,
// and build a DeviceResponse with selected elements and a device signature (COSE_Sign1).
import { EmbeddedCbor, Tagged, decodeCbor, encodeCbor, get, toPlain, type CborMap } from '../lib/cbor';
import { sha256, signEs256, verifyEs256, type PublicJwk } from '../lib/crypto';
import { base64UrlToBytes, bytesToBase64Url } from '../lib/encoding';
import type { Claim } from '../lib/types';
import { parseCertificate, type Certificate } from '../lib/x509';

export type IssuerSignedItem = {
  digestID: number;
  elementIdentifier: string;
  elementValue: unknown;
  /** The tag-24 wrapper exactly as issued; re-sent unchanged so digests still match. */
  raw: EmbeddedCbor;
};

export type ParsedMdoc = {
  docType: string;
  nameSpaces: Map<string, IssuerSignedItem[]>;
  issuerAuth: unknown[];
  validFrom?: string;
  validUntil?: string;
  issuerCertificate?: Certificate;
  digestsValid: boolean;
};

const COSE_ALG = 1;
const COSE_X5CHAIN = 33;
const ES256 = -7;

function coseSign1Parts(sign1: unknown[]) {
  const [protectedBytes, unprotected, payload, signature] = sign1 as [Uint8Array, CborMap, Uint8Array | null, Uint8Array];
  return { protectedBytes, unprotected, payload, signature };
}

function sigStructure(protectedBytes: Uint8Array, payload: Uint8Array): Uint8Array {
  return encodeCbor(['Signature1', protectedBytes, new Uint8Array(0), payload]);
}

export function parseIssuerSigned(base64url: string): ParsedMdoc {
  const issuerSigned = decodeCbor(base64UrlToBytes(base64url));
  const issuerAuth = get(issuerSigned, 'issuerAuth') as unknown[];
  const { payload, unprotected, protectedBytes } = coseSign1Parts(issuerAuth);
  if (!payload) throw new Error('issuerAuth has no payload');
  const msoWrapped = decodeCbor(payload);
  const mso = msoWrapped instanceof EmbeddedCbor ? msoWrapped.decode() : msoWrapped;

  const nameSpaces = new Map<string, IssuerSignedItem[]>();
  const nsRaw = get(issuerSigned, 'nameSpaces');
  const entries = nsRaw instanceof Map ? [...nsRaw.entries()] : Object.entries((nsRaw ?? {}) as Record<string, unknown>);
  let digestsValid = true;
  const valueDigests = get(mso, 'valueDigests');
  for (const [ns, items] of entries) {
    const list: IssuerSignedItem[] = [];
    for (const wrapped of items as EmbeddedCbor[]) {
      const item = wrapped.decode();
      const digestID = get(item, 'digestID') as number;
      const expected = get(get(valueDigests, ns as string), digestID) as Uint8Array | undefined;
      const actual = sha256(encodeCbor(wrapped));
      if (!expected || !bytesEqual(expected, actual)) digestsValid = false;
      list.push({
        digestID,
        elementIdentifier: get(item, 'elementIdentifier') as string,
        elementValue: get(item, 'elementValue'),
        raw: wrapped,
      });
    }
    nameSpaces.set(ns as string, list);
  }

  // x5chain may be in the unprotected (usual) or protected header.
  const protectedHeader = protectedBytes.length ? (decodeCbor(protectedBytes) as CborMap) : new Map();
  const x5 = (unprotected instanceof Map ? unprotected.get(COSE_X5CHAIN) : undefined) ?? protectedHeader.get(COSE_X5CHAIN);
  const leaf = Array.isArray(x5) ? (x5[0] as Uint8Array) : (x5 as Uint8Array | undefined);
  const validity = get(mso, 'validityInfo');
  const date = (v: unknown) => (v instanceof Tagged ? String(v.value) : typeof v === 'string' ? v : undefined);

  return {
    docType: get(mso, 'docType') as string,
    nameSpaces,
    issuerAuth,
    validFrom: date(get(validity, 'validFrom')),
    validUntil: date(get(validity, 'validUntil')),
    issuerCertificate: leaf ? parseCertificate(leaf) : undefined,
    digestsValid,
  };
}

/** Verifies the issuer's COSE signature against the leaf certificate key (no chain validation). */
export function verifyIssuerSignature(parsed: ParsedMdoc): boolean {
  const key = parsed.issuerCertificate?.publicKey;
  if (!key) return false;
  const { protectedBytes, payload, signature } = coseSign1Parts(parsed.issuerAuth);
  return payload ? verifyEs256(key, sigStructure(protectedBytes, payload), signature) : false;
}

function bytesEqual(a: Uint8Array, b: Uint8Array) {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

export function listMdocClaims(parsed: ParsedMdoc): Claim[] {
  const out: Claim[] = [];
  for (const [ns, items] of parsed.nameSpaces) {
    for (const it of items) out.push({ path: [ns, it.elementIdentifier], value: toPlain(it.elementValue), selectable: true });
  }
  return out;
}

/** OpenID4VP 1.0 (Appendix B.2.6.1) handover for redirect-based flows. */
export function openId4VpSessionTranscript(params: {
  clientId: string;
  nonce: string;
  responseUri: string;
  jwkThumbprint?: Uint8Array | null;
}): unknown[] {
  const info = encodeCbor([params.clientId, params.nonce, params.jwkThumbprint ?? null, params.responseUri]);
  return [null, null, ['OpenID4VPHandover', sha256(info)]];
}

/** ISO/IEC 18013-7 Annex B handover used by pre-1.0 OpenID4VP verifiers. */
export function iso180137SessionTranscript(params: {
  clientId: string;
  nonce: string;
  responseUri: string;
  mdocGeneratedNonce: string;
}): unknown[] {
  const clientIdHash = sha256(encodeCbor([params.clientId, params.mdocGeneratedNonce]));
  const responseUriHash = sha256(encodeCbor([params.responseUri, params.mdocGeneratedNonce]));
  return [null, null, [clientIdHash, responseUriHash, params.nonce]];
}

export function buildDeviceResponse(
  parsed: ParsedMdoc,
  selected: string[][],
  holderSecret: Uint8Array,
  sessionTranscript: unknown[],
): string {
  const nameSpaces = new Map<string, EmbeddedCbor[]>();
  for (const [ns, items] of parsed.nameSpaces) {
    const chosen = items.filter((it) => selected.some((p) => p[0] === ns && p[1] === it.elementIdentifier));
    if (chosen.length) nameSpaces.set(ns, chosen.map((it) => it.raw));
  }

  const deviceNameSpaces = EmbeddedCbor.of(new Map());
  const deviceAuthentication = ['DeviceAuthentication', sessionTranscript, parsed.docType, deviceNameSpaces];
  const deviceAuthenticationBytes = encodeCbor(EmbeddedCbor.of(deviceAuthentication));
  const protectedBytes = encodeCbor(new Map([[COSE_ALG, ES256]]));
  const signature = signEs256(holderSecret, sigStructure(protectedBytes, deviceAuthenticationBytes));

  const document = new Map<string, unknown>([
    ['docType', parsed.docType],
    ['issuerSigned', new Map<string, unknown>([['nameSpaces', nameSpaces], ['issuerAuth', parsed.issuerAuth]])],
    [
      'deviceSigned',
      new Map<string, unknown>([
        ['nameSpaces', deviceNameSpaces],
        ['deviceAuth', new Map([['deviceSignature', [protectedBytes, new Map(), null, signature]]])],
      ]),
    ],
  ]);
  const response = new Map<string, unknown>([
    ['version', '1.0'],
    ['documents', [document]],
    ['status', 0],
  ]);
  return bytesToBase64Url(encodeCbor(response));
}

/** COSE_Key (EC2, P-256) for a holder JWK, as placed in the MSO deviceKeyInfo. */
export function coseKeyFromJwk(jwk: PublicJwk): CborMap {
  return new Map<unknown, unknown>([
    [1, 2],
    [-1, 1],
    [-2, base64UrlToBytes(jwk.x)],
    [-3, base64UrlToBytes(jwk.y)],
  ]);
}

/**
 * Issues a test mdoc signed by `issuerSecret` with the certificate `issuerCertDer` in x5chain.
 * Only used by tests; real mdocs come from issuers.
 */
export function issueTestMdoc(params: {
  docType: string;
  nameSpaces: Record<string, Record<string, unknown>>;
  issuerSecret: Uint8Array;
  issuerCertDer: Uint8Array;
  deviceKey: PublicJwk;
}): string {
  const valueDigests = new Map<string, Map<number, Uint8Array>>();
  const nameSpaces = new Map<string, EmbeddedCbor[]>();
  let id = 0;
  for (const [ns, elements] of Object.entries(params.nameSpaces)) {
    const digests = new Map<number, Uint8Array>();
    const items: EmbeddedCbor[] = [];
    for (const [k, v] of Object.entries(elements)) {
      const item = EmbeddedCbor.of(
        new Map<string, unknown>([
          ['digestID', id],
          ['random', new Uint8Array(16).fill(id + 1)],
          ['elementIdentifier', k],
          ['elementValue', v],
        ]),
      );
      digests.set(id++, sha256(encodeCbor(item)));
      items.push(item);
    }
    valueDigests.set(ns, digests);
    nameSpaces.set(ns, items);
  }
  const now = new Date();
  const later = new Date(now.getTime() + 365 * 86400_000);
  const tdate = (d: Date) => new Tagged(0, d.toISOString().replace(/\.\d{3}Z$/, 'Z'));
  const mso = new Map<string, unknown>([
    ['version', '1.0'],
    ['digestAlgorithm', 'SHA-256'],
    ['valueDigests', valueDigests],
    ['deviceKeyInfo', new Map([['deviceKey', coseKeyFromJwk(params.deviceKey)]])],
    ['docType', params.docType],
    ['validityInfo', new Map([['signed', tdate(now)], ['validFrom', tdate(now)], ['validUntil', tdate(later)]])],
  ]);
  const payload = encodeCbor(EmbeddedCbor.of(mso));
  const protectedBytes = encodeCbor(new Map([[COSE_ALG, ES256]]));
  const signature = signEs256(params.issuerSecret, sigStructure(protectedBytes, payload));
  const issuerAuth = [protectedBytes, new Map([[COSE_X5CHAIN, params.issuerCertDer]]), payload, signature];
  return bytesToBase64Url(encodeCbor(new Map<string, unknown>([['nameSpaces', nameSpaces], ['issuerAuth', issuerAuth]])));
}

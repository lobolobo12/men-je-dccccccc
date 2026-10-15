// Turns a credential exactly as received from an issuer into what the wallet stores.
import { randomId, type HolderKey } from '../lib/crypto';
import { kindOf } from '../lib/kinds';
import type { StoredCredential } from '../lib/types';
import { parseCertificate } from '../lib/x509';
import { decodeJws, verifyJwsEs256 } from './jose';
import { listMdocClaims, parseIssuerSigned, verifyIssuerSignature } from './mdoc';
import { listClaims, parseSdJwt } from './sdjwt';

export type IssuerInfo = { id: string; name?: string };

export type Verification = {
  /** Issuer signature verified against the key in its certificate (x5c / x5chain). */
  signatureValid: boolean;
  /** For mdoc: every element matches its digest in the signed MSO. */
  integrityValid: boolean;
  certificateSubject?: string;
};

export function normaliseFormat(format: string): StoredCredential['format'] {
  if (format === 'mso_mdoc') return 'mso_mdoc';
  if (format === 'dc+sd-jwt' || format === 'vc+sd-jwt') return 'dc+sd-jwt';
  throw new Error(`Unsupported credential format ${format}`);
}

export function storeCredential(
  format: string,
  raw: string,
  holderKey: HolderKey,
  issuer: IssuerInfo,
): { credential: StoredCredential; verification: Verification } {
  const f = normaliseFormat(format);
  const receivedAt = new Date().toISOString();
  if (f === 'mso_mdoc') {
    const m = parseIssuerSigned(raw);
    const subject = m.issuerCertificate?.subject;
    return {
      credential: {
        id: randomId(),
        kind: kindOf(m.docType),
        format: f,
        type: m.docType,
        raw,
        claims: listMdocClaims(m),
        issuer: { id: issuer.id, name: issuer.name ?? subject?.O ?? subject?.CN },
        issuedAt: m.validFrom,
        expiresAt: m.validUntil,
        receivedAt,
        holderKey,
      },
      verification: {
        signatureValid: verifyIssuerSignature(m),
        integrityValid: m.digestsValid,
        certificateSubject: subject ? Object.values(subject).join(', ') : undefined,
      },
    };
  }

  const p = parseSdJwt(raw);
  const x5c = p.header.x5c as string[] | undefined;
  const cert = x5c?.length ? parseCertificate(x5c[0]) : undefined;
  const signatureValid = cert?.publicKey ? verifyJwsEs256(decodeJws(p.jwt), cert.publicKey) : false;
  const cnf = (p.payload.cnf as { jwk?: { x: string; y: string } } | undefined)?.jwk;
  if (cnf && (cnf.x !== holderKey.publicJwk.x || cnf.y !== holderKey.publicJwk.y)) {
    throw new Error('Credential is bound to a different key');
  }
  const date = (v: unknown) => (typeof v === 'number' ? new Date(v * 1000).toISOString() : undefined);
  const vct = String(p.payload.vct ?? 'unknown');
  return {
    credential: {
      id: randomId(),
      kind: kindOf(vct),
      format: f,
      type: vct,
      raw,
      claims: listClaims(p),
      issuer: { id: issuer.id, name: issuer.name ?? cert?.subject.O ?? cert?.subject.CN },
      issuedAt: date(p.payload.iat),
      expiresAt: date(p.payload.exp),
      receivedAt,
      holderKey,
    },
    verification: {
      signatureValid,
      integrityValid: true,
      certificateSubject: cert ? Object.values(cert.subject).join(', ') : undefined,
    },
  };
}


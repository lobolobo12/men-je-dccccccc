// Just enough DER/X.509 parsing to read a certificate's subject, validity, DNS SANs and
// P-256 public key. It does not validate chains; trust decisions are made by the caller.
import { base64ToBytes } from './encoding';
import { sha256 } from './crypto';

type Tlv = { tag: number; start: number; header: number; length: number; end: number };

function tlv(b: Uint8Array, pos: number): Tlv {
  const tag = b[pos];
  let len = b[pos + 1];
  let header = 2;
  if (len & 0x80) {
    const n = len & 0x7f;
    len = 0;
    for (let i = 0; i < n; i++) len = len * 256 + b[pos + 2 + i];
    header += n;
  }
  if (pos + header + len > b.length) throw new Error('Truncated DER');
  return { tag, start: pos, header, length: len, end: pos + header + len };
}

function children(b: Uint8Array, t: Tlv): Tlv[] {
  const out: Tlv[] = [];
  let p = t.start + t.header;
  while (p < t.end) {
    const c = tlv(b, p);
    out.push(c);
    p = c.end;
  }
  return out;
}

const content = (b: Uint8Array, t: Tlv) => b.subarray(t.start + t.header, t.end);

function oid(bytes: Uint8Array): string {
  const parts = [Math.floor(bytes[0] / 40), bytes[0] % 40];
  let v = 0;
  for (let i = 1; i < bytes.length; i++) {
    v = v * 128 + (bytes[i] & 0x7f);
    if (!(bytes[i] & 0x80)) {
      parts.push(v);
      v = 0;
    }
  }
  return parts.join('.');
}

function time(b: Uint8Array, t: Tlv): Date {
  const s = new TextDecoder().decode(content(b, t));
  // UTCTime YYMMDDHHMMSSZ or GeneralizedTime YYYYMMDDHHMMSSZ
  const full = t.tag === 0x17 ? (Number(s.slice(0, 2)) >= 50 ? '19' : '20') + s : s;
  return new Date(
    Date.UTC(+full.slice(0, 4), +full.slice(4, 6) - 1, +full.slice(6, 8), +full.slice(8, 10), +full.slice(10, 12), +full.slice(12, 14)),
  );
}

const NAME_OIDS: Record<string, string> = { '2.5.4.3': 'CN', '2.5.4.10': 'O', '2.5.4.6': 'C', '2.5.4.11': 'OU', '2.5.4.7': 'L' };

function name(b: Uint8Array, t: Tlv): Record<string, string> {
  const out: Record<string, string> = {};
  for (const set of children(b, t)) {
    for (const atv of children(b, set)) {
      const [type, value] = children(b, atv);
      const key = NAME_OIDS[oid(content(b, type))];
      if (key) out[key] = new TextDecoder().decode(content(b, value));
    }
  }
  return out;
}

export type Certificate = {
  der: Uint8Array;
  subject: Record<string, string>;
  issuer: Record<string, string>;
  notBefore: Date;
  notAfter: Date;
  dnsNames: string[];
  uris: string[];
  /** Uncompressed SEC1 point (0x04||x||y) when the key is EC P-256. */
  publicKey?: Uint8Array;
};

export function parseCertificate(input: Uint8Array | string): Certificate {
  const der = typeof input === 'string' ? base64ToBytes(input) : input;
  const cert = tlv(der, 0);
  const [tbs] = children(der, cert);
  let fields = children(der, tbs);
  if (fields[0].tag === 0xa0) fields = fields.slice(1); // explicit version
  const [, , issuerT, validityT, subjectT, spkiT, ...rest] = fields;
  const [nb, na] = children(der, validityT);

  const [algSeq, keyBits] = children(der, spkiT);
  const algOids = children(der, algSeq).filter((c) => c.tag === 0x06).map((c) => oid(content(der, c)));
  const publicKey =
    algOids[0] === '1.2.840.10045.2.1' && algOids[1] === '1.2.840.10045.3.1.7' ? content(der, keyBits).slice(1) : undefined;

  const dnsNames: string[] = [];
  const uris: string[] = [];
  const extWrapper = rest.find((c) => c.tag === 0xa3);
  if (extWrapper) {
    const [exts] = children(der, extWrapper);
    for (const ext of children(der, exts)) {
      const parts = children(der, ext);
      if (oid(content(der, parts[0])) !== '2.5.29.17') continue;
      const octet = parts[parts.length - 1];
      const inner = content(der, octet);
      const seq = tlv(inner, 0);
      for (const gn of children(inner, seq)) {
        const v = new TextDecoder().decode(content(inner, gn));
        if (gn.tag === 0x82) dnsNames.push(v);
        if (gn.tag === 0x86) uris.push(v);
      }
    }
  }

  return {
    der,
    subject: name(der, subjectT),
    issuer: name(der, issuerT),
    notBefore: time(der, nb),
    notAfter: time(der, na),
    dnsNames,
    uris,
    publicKey,
  };
}

/** SHA-256 of the DER certificate, base64url — the value used by the x509_hash client identifier prefix. */
export function certificateHash(der: Uint8Array): Uint8Array {
  return sha256(der);
}

/** Converts an ASN.1 DER ECDSA signature (SEQUENCE{r,s}) to raw r||s. */
export function derSignatureToRaw(sig: Uint8Array, size = 32): Uint8Array {
  const seq = tlv(sig, 0);
  const [r, s] = children(sig, seq);
  const out = new Uint8Array(size * 2);
  const put = (bytes: Uint8Array, offset: number) => {
    const trimmed = bytes[0] === 0 ? bytes.subarray(1) : bytes;
    out.set(trimmed.subarray(Math.max(0, trimmed.length - size)), offset + size - Math.min(size, trimmed.length));
  };
  put(content(sig, r), 0);
  put(content(sig, s), size);
  return out;
}

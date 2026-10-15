// Builds self-signed P-256 X.509 certificates on the device. Only used for the built-in demo
// issuer and verifier, so the demo flows run through the same certificate checks as real ones.
import { signEs256 } from './crypto';
import { base64UrlToBytes, utf8 } from './encoding';
import type { HolderKey } from './crypto';

function len(n: number): number[] {
  if (n < 0x80) return [n];
  const out: number[] = [];
  while (n > 0) {
    out.unshift(n & 0xff);
    n >>= 8;
  }
  return [0x80 | out.length, ...out];
}

function tlv(tag: number, content: Uint8Array | number[]): Uint8Array {
  const c = content instanceof Uint8Array ? Array.from(content) : content;
  return Uint8Array.from([tag, ...len(c.length), ...c]);
}

const cat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
};

const seq = (...items: Uint8Array[]) => tlv(0x30, cat(...items));
const set = (...items: Uint8Array[]) => tlv(0x31, cat(...items));

function oid(dotted: string): Uint8Array {
  const parts = dotted.split('.').map(Number);
  const out = [parts[0] * 40 + parts[1]];
  for (const p of parts.slice(2)) {
    const bytes = [p & 0x7f];
    let v = p >> 7;
    while (v > 0) {
      bytes.unshift((v & 0x7f) | 0x80);
      v >>= 7;
    }
    out.push(...bytes);
  }
  return tlv(0x06, out);
}

function int(bytes: Uint8Array): Uint8Array {
  let b = Array.from(bytes);
  while (b.length > 1 && b[0] === 0 && !(b[1] & 0x80)) b = b.slice(1);
  if (b[0] & 0x80) b = [0, ...b];
  return tlv(0x02, b);
}

function utcTime(d: Date): Uint8Array {
  const p = (n: number) => String(n).padStart(2, '0');
  const s = `${p(d.getUTCFullYear() % 100)}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
  return tlv(0x17, utf8(s));
}

function name(subject: Record<string, string>): Uint8Array {
  const ids: Record<string, string> = { C: '2.5.4.6', O: '2.5.4.10', CN: '2.5.4.3' };
  return seq(
    ...Object.entries(subject).map(([k, v]) =>
      set(seq(oid(ids[k]), k === 'C' ? tlv(0x13, utf8(v)) : tlv(0x0c, utf8(v)))),
    ),
  );
}

/** Raw r||s → DER SEQUENCE{INTEGER r, INTEGER s}. */
function rawToDer(sig: Uint8Array): Uint8Array {
  return seq(int(sig.subarray(0, 32)), int(sig.subarray(32)));
}

export function selfSignedCertificate(
  key: HolderKey,
  subject: Record<string, string>,
  opts: { dnsName?: string; days?: number } = {},
): Uint8Array {
  const ecdsaWithSha256 = seq(oid('1.2.840.10045.4.3.2'));
  const now = new Date();
  const until = new Date(now.getTime() + (opts.days ?? 365) * 86400_000);
  const point = Uint8Array.from([4, ...base64UrlToBytes(key.publicJwk.x), ...base64UrlToBytes(key.publicJwk.y)]);
  const spki = seq(seq(oid('1.2.840.10045.2.1'), oid('1.2.840.10045.3.1.7')), tlv(0x03, [0, ...point]));
  const extensions = opts.dnsName
    ? tlv(0xa3, seq(seq(oid('2.5.29.17'), tlv(0x04, seq(tlv(0x82, utf8(opts.dnsName)))))))
    : new Uint8Array(0);
  const serial = int(Uint8Array.from([1, ...utf8(key.id).subarray(0, 8)]));
  const tbs = seq(
    tlv(0xa0, tlv(0x02, [2])),
    serial,
    ecdsaWithSha256,
    name(subject),
    seq(utcTime(now), utcTime(until)),
    name(subject),
    spki,
    extensions,
  );
  const signature = rawToDer(signEs256(base64UrlToBytes(key.privateKey), tbs));
  return seq(tbs, ecdsaWithSha256, tlv(0x03, [0, ...signature]));
}

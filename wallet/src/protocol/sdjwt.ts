// SD-JWT (RFC 9901) and SD-JWT VC handling for the holder: parse, list disclosable
// claims, build a presentation with only the chosen disclosures plus a Key Binding JWT.
import { randomBytes, sha256, signJwt } from '../lib/crypto';
import { base64UrlDecodeJson, base64UrlEncodeJson, bytesToBase64Url, utf8 } from '../lib/encoding';
import type { Claim } from '../lib/types';

export type Disclosure = {
  encoded: string;
  digest: string;
  name?: string;
  value: unknown;
  path: string[];
};

export type ParsedSdJwt = {
  jwt: string;
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  disclosures: Disclosure[];
  /** Fully reconstructed claims (what a verifier would see if everything were disclosed). */
  claims: Record<string, unknown>;
  keyBindingJwt?: string;
};

const RESERVED = new Set(['iss', 'iat', 'nbf', 'exp', 'cnf', 'vct', 'vct#integrity', 'status', 'sub', '_sd', '_sd_alg', 'jti']);

export function digestOf(encodedDisclosure: string): string {
  return bytesToBase64Url(sha256(utf8(encodedDisclosure)));
}

export function parseSdJwt(compact: string): ParsedSdJwt {
  const parts = compact.trim().split('~');
  const jwt = parts[0];
  const last = parts[parts.length - 1];
  const keyBindingJwt = last && last.split('.').length === 3 ? last : undefined;
  const encoded = parts.slice(1, keyBindingJwt ? -1 : undefined).filter((p) => p.length > 0);
  const [h, p] = jwt.split('.');
  const header = base64UrlDecodeJson<Record<string, unknown>>(h);
  const payload = base64UrlDecodeJson<Record<string, unknown>>(p);
  if (payload._sd_alg && payload._sd_alg !== 'sha-256') throw new Error(`Unsupported _sd_alg ${String(payload._sd_alg)}`);

  const byDigest = new Map<string, { encoded: string; raw: unknown[] }>();
  for (const e of encoded) {
    const raw = base64UrlDecodeJson<unknown[]>(e);
    if (!Array.isArray(raw) || (raw.length !== 2 && raw.length !== 3)) throw new Error('Malformed disclosure');
    byDigest.set(digestOf(e), { encoded: e, raw });
  }

  const disclosures: Disclosure[] = [];
  const used = new Set<string>();

  const unpack = (node: unknown, path: string[]): unknown => {
    if (Array.isArray(node)) {
      const out: unknown[] = [];
      node.forEach((item) => {
        if (item && typeof item === 'object' && !Array.isArray(item) && Object.keys(item).length === 1 && '...' in item) {
          const digest = (item as Record<string, string>)['...'];
          const d = byDigest.get(digest);
          if (!d) return; // undisclosed element
          if (used.has(digest)) throw new Error('Duplicate disclosure digest');
          used.add(digest);
          const elementPath = [...path, String(out.length)];
          const value = unpack(d.raw[1], elementPath);
          disclosures.push({ encoded: d.encoded, digest, value, path: elementPath });
          out.push(value);
        } else {
          out.push(unpack(item, [...path, String(out.length)]));
        }
      });
      return out;
    }
    if (node && typeof node === 'object') {
      const obj = node as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(obj)) {
        if (k === '_sd' || k === '_sd_alg') continue;
        out[k] = unpack(v, [...path, k]);
      }
      for (const digest of (obj._sd as string[] | undefined) ?? []) {
        const d = byDigest.get(digest);
        if (!d) continue;
        if (used.has(digest)) throw new Error('Duplicate disclosure digest');
        used.add(digest);
        const name = d.raw[1] as string;
        if (name in out) throw new Error(`Disclosure overwrites claim ${name}`);
        const value = unpack(d.raw[2], [...path, name]);
        disclosures.push({ encoded: d.encoded, digest, name, value, path: [...path, name] });
        out[name] = value;
      }
      return out;
    }
    return node;
  };

  const claims = unpack(payload, []) as Record<string, unknown>;
  return { jwt, header, payload, disclosures, claims, keyBindingJwt };
}

const isPrefix = (a: string[], b: string[]) => a.length <= b.length && a.every((s, i) => s === b[i]);

/** Leaves the holder sees and can choose from; always-disclosed payload claims are not selectable. */
export function listClaims(parsed: ParsedSdJwt): Claim[] {
  const out: Claim[] = [];
  const leaves = parsed.disclosures.filter((d) => !parsed.disclosures.some((o) => o !== d && isPrefix(d.path, o.path)));
  for (const d of leaves) out.push({ path: d.path, value: d.value, selectable: true });
  for (const [k, v] of Object.entries(parsed.payload)) {
    if (RESERVED.has(k)) continue;
    if (parsed.disclosures.some((d) => d.path[0] === k)) continue;
    out.push({ path: [k], value: v, selectable: false });
  }
  return out;
}

/** Disclosures needed to reveal the given claim paths (parents and children included). */
export function selectDisclosures(parsed: ParsedSdJwt, paths: string[][]): Disclosure[] {
  return parsed.disclosures.filter((d) => paths.some((p) => isPrefix(d.path, p) || isPrefix(p, d.path)));
}

export function present(
  parsed: ParsedSdJwt,
  paths: string[][],
  holderSecret: Uint8Array,
  binding: { aud: string; nonce: string; iat?: number },
): string {
  const chosen = selectDisclosures(parsed, paths);
  const sdJwt = `${parsed.jwt}~${chosen.map((d) => `${d.encoded}~`).join('')}`;
  const kb = signJwt(
    holderSecret,
    { typ: 'kb+jwt' },
    {
      iat: binding.iat ?? Math.floor(Date.now() / 1000),
      aud: binding.aud,
      nonce: binding.nonce,
      sd_hash: bytesToBase64Url(sha256(utf8(sdJwt))),
    },
  );
  return sdJwt + kb;
}

/**
 * Issues an SD-JWT VC where every claim (recursively for objects) is selectively disclosable.
 * Used for the bundled demo credentials and in tests; real credentials come from issuers.
 */
export function issueSdJwtVc(
  issuerSecret: Uint8Array,
  header: Record<string, unknown>,
  base: Record<string, unknown>,
  claims: Record<string, unknown>,
): string {
  const disclosures: string[] = [];
  const salt = () => bytesToBase64Url(randomBytes(16));
  const conceal = (obj: Record<string, unknown>): Record<string, unknown> => {
    const sd: string[] = [];
    for (const [k, v] of Object.entries(obj)) {
      const value = v && typeof v === 'object' && !Array.isArray(v) ? conceal(v as Record<string, unknown>) : v;
      const enc = base64UrlEncodeJson([salt(), k, value]);
      disclosures.push(enc);
      sd.push(digestOf(enc));
    }
    return { _sd: sd.sort() };
  };
  const payload = { ...base, ...conceal(claims), _sd_alg: 'sha-256' };
  const jwt = signJwt(issuerSecret, { typ: 'dc+sd-jwt', ...header }, payload);
  return `${jwt}~${disclosures.map((d) => `${d}~`).join('')}`;
}

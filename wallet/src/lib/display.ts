import type { StringKey } from '../i18n/strings';
import type { Claim, StoredCredential } from './types';

export function claimValue(credential: StoredCredential, name: string): string | undefined {
  const claim = credential.claims.find((c) => c.path[c.path.length - 1] === name);
  return claim && (typeof claim.value === 'string' || typeof claim.value === 'number') ? String(claim.value) : undefined;
}

export function credentialTitle(credential: StoredCredential, t: (k: StringKey) => string): string {
  return t(`kind_${credential.kind}` as StringKey);
}

/** Attribute identifier for a claim; array elements use their parent's name. */
export function claimName(claim: Claim): string {
  const named = claim.path.filter((s) => !/^\d+$/.test(s));
  return named[named.length - 1] ?? claim.path.join('.');
}

/** Human-readable value; images and nested structures are summarised. */
export function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '–';
  if (typeof value === 'boolean') return value ? '✓' : '✗';
  if (typeof value === 'string') return value.startsWith('data:image') || value.length > 300 ? `[${value.length} B]` : value;
  if (typeof value === 'number') return String(value);
  if (value instanceof Uint8Array) return `[${value.length} B]`;
  if (Array.isArray(value)) return value.map(formatValue).join(', ');
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => `${k}: ${formatValue(v)}`)
      .join('; ');
  }
  return String(value);
}

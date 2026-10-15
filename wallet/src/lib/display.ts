import { attributeLabel } from '../i18n/attributes';
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

// Order attributes the way a person reads an ID document; anything else follows in issuer order.
const ORDER = [
  'given_name', 'family_name', 'birth_date', 'birthdate', 'age_over_18', 'place_of_birth', 'birth_place',
  'nationality', 'nationalities', 'sex', 'personal_administrative_number', 'document_number', 'driving_privileges',
  'title', 'institution', 'graduation_date', 'eqf_level', 'personal_id', 'ehic_card_id', 'institution_name',
  'address', 'street_address', 'locality', 'postal_code', 'country',
  'issuing_authority', 'issuing_country', 'issue_date', 'expiry_date', 'ending_date',
];

export function sortClaims(claims: Claim[]): Claim[] {
  const rank = (c: Claim) => {
    const i = ORDER.indexOf(claimName(c));
    return i < 0 ? ORDER.length : i;
  };
  return claims.map((c, i) => ({ c, i })).sort((a, b) => rank(a.c) - rank(b.c) || a.i - b.i).map((x) => x.c);
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Human-readable value; images and nested structures are summarised, ISO dates localised. */
export function formatValue(value: unknown, locale: 'sl' | 'en' = 'en'): string {
  if (typeof value === 'string') {
    const m = ISO_DATE.exec(value);
    if (m) return locale === 'sl' ? `${+m[3]}. ${+m[2]}. ${m[1]}` : `${+m[3]} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+m[2] - 1]} ${m[1]}`;
  }
  return formatRaw(value, locale);
}

function formatRaw(value: unknown, locale: 'sl' | 'en'): string {
  if (value === null || value === undefined) return '–';
  if (typeof value === 'boolean') return value ? '✓' : '✗';
  if (typeof value === 'string') return value.startsWith('data:image') || value.length > 300 ? `[${value.length} B]` : value;
  if (typeof value === 'number') return String(value);
  if (value instanceof Uint8Array) return `[${value.length} B]`;
  if (Array.isArray(value)) return value.map((v) => formatValue(v, locale)).join(', ');
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>;
    // ISO 18013-5 driving privilege: "B (1. 6. 2013 – 1. 6. 2033)"
    if (typeof o.vehicle_category_code === 'string') {
      const range = [o.issue_date, o.expiry_date].filter(Boolean).map((d) => formatValue(d, locale)).join(' – ');
      return range ? `${o.vehicle_category_code} (${range})` : o.vehicle_category_code;
    }
    return Object.entries(o)
      .map(([k, v]) => `${attributeLabel(k, locale)}: ${formatValue(v, locale)}`)
      .join(', ');
  }
  return String(value);
}

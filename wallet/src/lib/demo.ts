import { generateHolderKey, randomId } from './crypto';
import { base64UrlToBytes } from './encoding';
import { kindOf } from './kinds';
import type { StoredCredential } from './types';
import { issueSdJwtVc, listClaims, parseSdJwt } from '../protocol/sdjwt';

const DEMO_ISSUER = 'https://demo.si-wallet.invalid';

// Fictional person; data shapes follow the PID rulebook, ISO 18013-5 mDL, EHIC and diploma attestations.
const SAMPLES: { vct: string; claims: Record<string, unknown> }[] = [
  {
    vct: 'urn:eudi:pid:1',
    claims: {
      family_name: 'Novak',
      given_name: 'Ana',
      birthdate: '1995-04-12',
      place_of_birth: { locality: 'Ljubljana', country: 'SI' },
      nationalities: ['SI'],
      address: { street_address: 'Prešernova cesta 1', locality: 'Ljubljana', postal_code: '1000', country: 'SI' },
      age_over_18: true,
      personal_administrative_number: '1204995505123',
      issuing_authority: 'Ministrstvo za notranje zadeve (DEMO)',
      issuing_country: 'SI',
    },
  },
  {
    vct: 'urn:eudi:mdl:1',
    claims: {
      family_name: 'Novak',
      given_name: 'Ana',
      birth_date: '1995-04-12',
      document_number: 'SI-DEMO-0001',
      issuing_country: 'SI',
      issuing_authority: 'Upravna enota Ljubljana (DEMO)',
      un_distinguishing_sign: 'SLO',
      driving_privileges: [{ vehicle_category_code: 'B', issue_date: '2013-06-01', expiry_date: '2033-06-01' }],
    },
  },
  {
    vct: 'urn:eudi:diploma:1',
    claims: {
      family_name: 'Novak',
      given_name: 'Ana',
      title: 'magistrica inženirka računalništva in informatike',
      institution: 'Univerza v Ljubljani (DEMO)',
      eqf_level: 7,
      graduation_date: '2020-09-25',
    },
  },
  {
    vct: 'urn:eudi:ehic:1',
    claims: {
      family_name: 'Novak',
      given_name: 'Ana',
      birth_date: '1995-04-12',
      personal_id: '123456789',
      ehic_card_id: '80705000000000000001',
      institution_id: 'ZZZS',
      institution_name: 'Zavod za zdravstveno zavarovanje Slovenije (DEMO)',
      institution_country: 'SI',
      ending_date: '2030-12-31',
    },
  },
];

/** Locally signed sample credentials so every screen can be tried without an issuer. */
export function makeDemoCredentials(): StoredCredential[] {
  const issuerKey = generateHolderKey();
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 365 * 24 * 3600;
  return SAMPLES.map(({ vct, claims }) => {
    const holderKey = generateHolderKey();
    const raw = issueSdJwtVc(
      base64UrlToBytes(issuerKey.privateKey),
      { kid: 'demo' },
      { iss: DEMO_ISSUER, vct, iat: now, exp, cnf: { jwk: holderKey.publicJwk } },
      claims,
    );
    const parsed = parseSdJwt(raw);
    return {
      id: randomId(),
      kind: kindOf(vct),
      format: 'dc+sd-jwt',
      type: vct,
      raw,
      claims: listClaims(parsed),
      issuer: { id: DEMO_ISSUER, name: 'SI Wallet DEMO' },
      issuedAt: new Date(now * 1000).toISOString(),
      expiresAt: new Date(exp * 1000).toISOString(),
      receivedAt: new Date().toISOString(),
      holderKey,
      demo: true,
    };
  });
}

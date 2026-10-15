import { generateHolderKey } from './crypto';
import { base64UrlToBytes, bytesToBase64 } from './encoding';
import type { StoredCredential } from './types';
import { selfSignedCertificate } from './x509build';
import { storeCredential } from '../protocol/credential';
import { issueTestMdoc } from '../protocol/mdoc';
import { issueSdJwtVc } from '../protocol/sdjwt';

export const DEMO_ISSUER = 'https://demo.si-wallet.invalid';
const ISSUER_INFO = { id: DEMO_ISSUER, name: 'SI Wallet DEMO' };

// Fictional person; data shapes follow the PID rulebook (SD-JWT VC), ISO/IEC 18013-5 mDL (mdoc),
// and the EHIC and diploma attestations.
const SD_JWT_SAMPLES: { vct: string; claims: Record<string, unknown> }[] = [
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

const MDL_NAMESPACE = 'org.iso.18013.5.1';
const MDL_ELEMENTS = {
  family_name: 'Novak',
  given_name: 'Ana',
  birth_date: '1995-04-12',
  issue_date: '2023-06-01',
  expiry_date: '2033-06-01',
  issuing_country: 'SI',
  issuing_authority: 'Upravna enota Ljubljana (DEMO)',
  document_number: 'SI-DEMO-0001',
  un_distinguishing_sign: 'SLO',
  age_over_18: true,
  driving_privileges: [{ vehicle_category_code: 'B', issue_date: '2013-06-01', expiry_date: '2033-06-01' }],
};

/**
 * Sample credentials signed on the device by a throwaway demo issuer with its own certificate,
 * so every screen (and the signature check) can be tried without a real issuer.
 */
export function makeDemoCredentials(): StoredCredential[] {
  const issuerKey = generateHolderKey();
  const issuerSecret = base64UrlToBytes(issuerKey.privateKey);
  const cert = selfSignedCertificate(issuerKey, { C: 'SI', O: 'SI Wallet DEMO', CN: 'Demo izdajatelj' });
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 365 * 24 * 3600;

  const sdJwt = SD_JWT_SAMPLES.map(({ vct, claims }) => {
    const holderKey = generateHolderKey();
    const raw = issueSdJwtVc(
      issuerSecret,
      { x5c: [bytesToBase64(cert)] },
      { iss: DEMO_ISSUER, vct, iat: now, exp, cnf: { jwk: holderKey.publicJwk } },
      claims,
    );
    return storeCredential('dc+sd-jwt', raw, holderKey, ISSUER_INFO);
  });

  const mdlKey = generateHolderKey();
  const mdl = storeCredential(
    'mso_mdoc',
    issueTestMdoc({
      docType: 'org.iso.18013.5.1.mDL',
      nameSpaces: { [MDL_NAMESPACE]: MDL_ELEMENTS },
      issuerSecret,
      issuerCertDer: cert,
      deviceKey: mdlKey.publicJwk,
    }),
    mdlKey,
    ISSUER_INFO,
  );

  const [pid, diploma, ehic] = sdJwt;
  return [pid, mdl, diploma, ehic].map(({ credential, verification }) => ({ ...credential, verification, demo: true }));
}

import type { HolderKey } from './crypto';

export type CredentialKind = 'pid' | 'mdl' | 'diploma' | 'ehic' | 'other';
export type CredentialFormat = 'dc+sd-jwt' | 'mso_mdoc';

/** One disclosable attribute, flattened for display and selective disclosure. */
export type Claim = {
  /** Path inside the credential, e.g. ["address", "locality"] or ["org.iso.18013.5.1", "family_name"]. */
  path: string[];
  value: unknown;
  /** True when the holder can choose to withhold it (SD-JWT disclosure or mdoc element). */
  selectable: boolean;
};

export type StoredCredential = {
  id: string;
  kind: CredentialKind;
  format: CredentialFormat;
  /** vct for SD-JWT VC, doctype for mdoc. */
  type: string;
  /** Issued credential exactly as received (compact SD-JWT, or base64url IssuerSigned CBOR). */
  raw: string;
  claims: Claim[];
  issuer: { id: string; name?: string };
  issuedAt?: string;
  expiresAt?: string;
  receivedAt: string;
  holderKey: HolderKey;
  demo?: boolean;
};

export type LogEntry = {
  id: string;
  at: string;
  type: 'issuance' | 'presentation' | 'presentation_declined' | 'deletion';
  counterparty: { id: string; name?: string };
  credentialIds: string[];
  attributes: string[];
  ok: boolean;
  detail?: string;
};

export type Settings = {
  locale: 'sl' | 'en' | null;
};

export type VaultData = {
  version: 1;
  credentials: StoredCredential[];
  log: LogEntry[];
  settings: Settings;
};

export const emptyVault = (): VaultData => ({
  version: 1,
  credentials: [],
  log: [],
  settings: { locale: null },
});

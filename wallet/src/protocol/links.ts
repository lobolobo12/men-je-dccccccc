export type WalletLink = { kind: 'offer'; uri: string } | { kind: 'request'; uri: string } | { kind: 'unknown' };

const OFFER_SCHEMES = ['openid-credential-offer:', 'haip-vci:'];
const REQUEST_SCHEMES = ['openid4vp:', 'eudi-openid4vp:', 'haip-vp:', 'haip:', 'mdoc-openid4vp:'];

/** Classifies a scanned or pasted string as an OpenID4VCI offer or an OpenID4VP request. */
export function classifyLink(input: string): WalletLink {
  const uri = input.trim();
  const lower = uri.toLowerCase();
  if (OFFER_SCHEMES.some((s) => lower.startsWith(s))) return { kind: 'offer', uri };
  if (REQUEST_SCHEMES.some((s) => lower.startsWith(s))) return { kind: 'request', uri };
  if (lower.startsWith('https://')) {
    // Same-device links can also arrive as https URLs carrying the parameters.
    if (/[?&](credential_offer|credential_offer_uri)=/.test(uri)) return { kind: 'offer', uri };
    if (/[?&](request_uri|client_id)=/.test(uri)) return { kind: 'request', uri };
  }
  return { kind: 'unknown' };
}

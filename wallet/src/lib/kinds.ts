import type { CredentialKind } from './types';

/** Maps a vct (SD-JWT VC) or doctype (mdoc) to the kind used for display. */
export function kindOf(type: string): CredentialKind {
  const t = type.toLowerCase();
  if (t.includes('pid')) return 'pid';
  if (t.includes('mdl') || t.includes('18013.5') || t.includes('driving')) return 'mdl';
  if (t.includes('ehic') || t.includes('health')) return 'ehic';
  if (t.includes('diploma') || t.includes('education') || t.includes('degree')) return 'diploma';
  return 'other';
}

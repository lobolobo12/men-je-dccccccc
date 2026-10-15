export const sl = {
  appName: 'SI Wallet',
  demoNotice: 'Demo – ni certificirana denarnica EU za digitalno identiteto.',

  // Onboarding / lock
  welcomeTitle: 'Dobrodošli v SI Wallet',
  welcomeBody:
    'Vaša digitalna identiteta, vozniško dovoljenje, diplome in kartica zdravstvenega zavarovanja – shranjeni samo na tem telefonu.',
  welcomePoints:
    '• Podatki ostanejo na napravi, brez strežnika ponudnika.\n• Vsako deljenje podatkov potrdite sami.\n• Vidite, kdo je kdaj zahteval vaše podatke.',
  getStarted: 'Začni',
  createPin: 'Nastavite 6-mestno kodo PIN',
  confirmPin: 'Ponovno vnesite kodo PIN',
  pinMismatch: 'Kodi PIN se ne ujemata. Poskusite znova.',
  enterPin: 'Vnesite kodo PIN',
  wrongPin: 'Napačna koda PIN. Preostali poskusi: {n}',
  lockedOut: 'Preveč napačnih poskusov. Denarnico je treba ponastaviti.',
  useBiometrics: 'Odkleni z biometrijo',
  unlockPrompt: 'Odklenite SI Wallet',
  resetWallet: 'Ponastavi denarnico',

  // Home
  myDocuments: 'Moji dokumenti',
  emptyTitle: 'Denarnica je prazna',
  emptyBody: 'Dodajte osebno izkaznico (PID), vozniško dovoljenje ali drugo potrdilo.',
  add: 'Dodaj',
  share: 'Pokaži',
  activity: 'Dejavnost',
  settings: 'Nastavitve',
  expires: 'Velja do {date}',
  expired: 'Poteklo',

  // Kinds
  kind_pid: 'Osebna identifikacija (PID)',
  kind_mdl: 'Mobilno vozniško dovoljenje',
  kind_diploma: 'Diploma',
  kind_ehic: 'Evropska kartica zdravstvenega zavarovanja',
  kind_other: 'Potrdilo o atributih',

  // Scan
  scanTitle: 'Skeniraj kodo QR',
  scanHint: 'Usmerite kamero v kodo QR izdajatelja ali preverjevalca.',
  pasteLink: 'Prilepi povezavo',
  pastePlaceholder: 'openid-credential-offer://… ali openid4vp://…',
  continue: 'Nadaljuj',
  cameraPermission: 'Za skeniranje kod QR potrebujemo dostop do kamere.',
  grantCamera: 'Dovoli kamero',
  unknownLink: 'Te povezave ne prepoznam.',
  comingSoon: 'Povezava je prepoznana. Prejem in deljenje potrdil prideta v naslednji posodobitvi.',

  // Issuance
  offerTitle: 'Ponudba potrdila',
  offerFrom: 'Izdajatelj',
  offerCredentials: 'Ponujena potrdila',
  txCode: 'Vnesite kodo, ki vam jo je poslal izdajatelj',
  accept: 'Sprejmi',
  decline: 'Zavrni',
  working: 'Obdelujem …',
  issuedOk: 'Potrdilo je shranjeno v denarnico.',

  // Presentation
  requestTitle: 'Zahteva za podatke',
  requestFrom: 'Zahteva',
  requestPurpose: 'Namen',
  requestedData: 'Zahtevani podatki',
  unverifiedVerifier: 'Identitete preverjevalca ni bilo mogoče preveriti. Delite le, če mu zaupate.',
  missingCredential: 'V denarnici nimate zahtevanega potrdila.',
  shareSelected: 'Deli izbrano',
  sharedOk: 'Podatki so bili poslani.',
  optional: 'neobvezno',

  // Credential detail
  details: 'Podrobnosti',
  issuer: 'Izdajatelj',
  issued: 'Izdano',
  format: 'Format',
  deleteCredential: 'Izbriši potrdilo',
  deleteConfirm: 'Res želite izbrisati to potrdilo? Tega ni mogoče razveljaviti.',
  cancel: 'Prekliči',
  delete: 'Izbriši',

  // Activity
  activityTitle: 'Dejavnost',
  activityEmpty: 'Ni še zabeleženih dejavnosti.',
  log_issuance: 'Prejeto potrdilo',
  log_presentation: 'Deljeni podatki',
  log_presentation_declined: 'Zavrnjena zahteva',
  log_deletion: 'Izbrisano potrdilo',
  reportToDpa: 'Prijavi Informacijskemu pooblaščencu',
  askErasure: 'Zahtevaj izbris podatkov',

  // Settings
  language: 'Jezik',
  languageSystem: 'Sistemski',
  exportData: 'Izvozi moje podatke',
  exportDone: 'Izvoz kopiran v odložišče (JSON).',
  addDemo: 'Dodaj vzorčna potrdila (demo)',
  demoAdded: 'Vzorčna potrdila so dodana.',
  lockNow: 'Zakleni denarnico',
  wipeAll: 'Izbriši vse podatke',
  wipeConfirm: 'Izbrisani bodo vsi dokumenti, ključi, dnevnik in koda PIN.',
  about: 'O aplikaciji',
  aboutBody:
    'SI Wallet v1 je prototip po Uredbi (EU) 2024/1183 (eIDAS 2.0). Ni certificiran in ni priglašen kot denarnica EU za digitalno identiteto. Uporablja OpenID4VCI, OpenID4VP, SD-JWT VC in ISO mdoc. Odprta koda pod licenco EUPL-1.2.',
  error: 'Napaka',
  ok: 'V redu',
} as const;

export type StringKey = keyof typeof sl;

export const en: Record<StringKey, string> = {
  appName: 'SI Wallet',
  demoNotice: 'Demo – not a certified EU Digital Identity Wallet.',

  welcomeTitle: 'Welcome to SI Wallet',
  welcomeBody: 'Your digital identity, driving licence, diplomas and health insurance card – stored only on this phone.',
  welcomePoints:
    '• Data stays on the device, no provider server.\n• You approve every data sharing yourself.\n• You can see who asked for your data and when.',
  getStarted: 'Get started',
  createPin: 'Set a 6-digit PIN',
  confirmPin: 'Enter the PIN again',
  pinMismatch: 'The PINs do not match. Try again.',
  enterPin: 'Enter your PIN',
  wrongPin: 'Wrong PIN. Attempts left: {n}',
  lockedOut: 'Too many wrong attempts. The wallet has to be reset.',
  useBiometrics: 'Unlock with biometrics',
  unlockPrompt: 'Unlock SI Wallet',
  resetWallet: 'Reset wallet',

  myDocuments: 'My documents',
  emptyTitle: 'Your wallet is empty',
  emptyBody: 'Add your identity data (PID), driving licence or another attestation.',
  add: 'Add',
  share: 'Present',
  activity: 'Activity',
  settings: 'Settings',
  expires: 'Valid until {date}',
  expired: 'Expired',

  kind_pid: 'Person identification (PID)',
  kind_mdl: 'Mobile driving licence',
  kind_diploma: 'Diploma',
  kind_ehic: 'European Health Insurance Card',
  kind_other: 'Attestation of attributes',

  scanTitle: 'Scan QR code',
  scanHint: 'Point the camera at the QR code of an issuer or verifier.',
  pasteLink: 'Paste link',
  pastePlaceholder: 'openid-credential-offer://… or openid4vp://…',
  continue: 'Continue',
  cameraPermission: 'Camera access is needed to scan QR codes.',
  grantCamera: 'Allow camera',
  unknownLink: 'This link is not recognised.',
  comingSoon: 'Link recognised. Receiving and sharing credentials arrive in the next update.',

  offerTitle: 'Credential offer',
  offerFrom: 'Issuer',
  offerCredentials: 'Offered credentials',
  txCode: 'Enter the code the issuer sent you',
  accept: 'Accept',
  decline: 'Decline',
  working: 'Working …',
  issuedOk: 'The credential was saved to your wallet.',

  requestTitle: 'Data request',
  requestFrom: 'Requested by',
  requestPurpose: 'Purpose',
  requestedData: 'Requested data',
  unverifiedVerifier: 'The verifier identity could not be verified. Only share if you trust it.',
  missingCredential: 'You do not have the requested credential.',
  shareSelected: 'Share selected',
  sharedOk: 'Your data was sent.',
  optional: 'optional',

  details: 'Details',
  issuer: 'Issuer',
  issued: 'Issued',
  format: 'Format',
  deleteCredential: 'Delete credential',
  deleteConfirm: 'Delete this credential? This cannot be undone.',
  cancel: 'Cancel',
  delete: 'Delete',

  activityTitle: 'Activity',
  activityEmpty: 'No activity yet.',
  log_issuance: 'Credential received',
  log_presentation: 'Data shared',
  log_presentation_declined: 'Request declined',
  log_deletion: 'Credential deleted',
  reportToDpa: 'Report to the data protection authority',
  askErasure: 'Request erasure of data',

  language: 'Language',
  languageSystem: 'System',
  exportData: 'Export my data',
  exportDone: 'Export copied to the clipboard (JSON).',
  addDemo: 'Add sample credentials (demo)',
  demoAdded: 'Sample credentials added.',
  lockNow: 'Lock wallet',
  wipeAll: 'Delete all data',
  wipeConfirm: 'All documents, keys, the activity log and the PIN will be deleted.',
  about: 'About',
  aboutBody:
    'SI Wallet v1 is a prototype following Regulation (EU) 2024/1183 (eIDAS 2.0). It is not certified or notified as an EU Digital Identity Wallet. It uses OpenID4VCI, OpenID4VP, SD-JWT VC and ISO mdoc. Open source under EUPL-1.2.',
  error: 'Error',
  ok: 'OK',
};

export const strings = { sl, en } as const;
export type Locale = keyof typeof strings;

export function format(template: string, vars: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`));
}

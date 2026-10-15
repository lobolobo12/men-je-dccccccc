export const sl = {
  appName: 'SI Wallet',
  demoNotice: 'Demo – ni certificirana denarnica EU za digitalno identiteto.',
} as const;

export type StringKey = keyof typeof sl;

export const en: Record<StringKey, string> = {
  appName: 'SI Wallet',
  demoNotice: 'Demo – not a certified EU Digital Identity Wallet.',
};

export const strings = { sl, en } as const;
export type Locale = keyof typeof strings;

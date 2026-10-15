import { getRandomValues } from 'expo-crypto';

// Hermes does not always expose Web Crypto; noble and our helpers only need getRandomValues.
const g = globalThis as unknown as { crypto?: { getRandomValues?: unknown } };
if (!g.crypto) g.crypto = {};
if (typeof g.crypto.getRandomValues !== 'function') g.crypto.getRandomValues = getRandomValues;

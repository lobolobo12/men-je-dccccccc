import { File, Paths } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import { constantTimeEqual, decrypt, encrypt, hashPin, PIN_ITERATIONS, randomBytes } from './crypto';
import { base64ToBytes, bytesToBase64, fromUtf8, utf8 } from './encoding';
import { emptyVault, type VaultData } from './types';

// The data key and PIN verifier live in the iOS Keychain / Android Keystore-backed
// SecureStore and never leave this device. The vault file itself is AES-256-GCM encrypted.
const KEY_DATA = 'siwallet.dataKey';
const KEY_PIN = 'siwallet.pin';
const KEY_ATTEMPTS = 'siwallet.pinAttempts';
const STORE_OPTS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export const MAX_PIN_ATTEMPTS = 5;

const vaultFile = () => new File(Paths.document, 'vault.bin');

type PinRecord = { salt: string; hash: string; iterations: number };

export async function isSetUp(): Promise<boolean> {
  return (await SecureStore.getItemAsync(KEY_PIN, STORE_OPTS)) !== null;
}

export async function setUp(pin: string): Promise<VaultData> {
  const salt = randomBytes(16);
  const record: PinRecord = { salt: bytesToBase64(salt), hash: bytesToBase64(hashPin(pin, salt)), iterations: PIN_ITERATIONS };
  await SecureStore.setItemAsync(KEY_DATA, bytesToBase64(randomBytes(32)), STORE_OPTS);
  await SecureStore.setItemAsync(KEY_PIN, JSON.stringify(record), STORE_OPTS);
  await SecureStore.setItemAsync(KEY_ATTEMPTS, '0', STORE_OPTS);
  const data = emptyVault();
  await save(data);
  return data;
}

export type PinResult = { ok: true } | { ok: false; attemptsLeft: number };

export async function checkPin(pin: string): Promise<PinResult> {
  const stored = await SecureStore.getItemAsync(KEY_PIN, STORE_OPTS);
  if (!stored) return { ok: false, attemptsLeft: 0 };
  const attempts = Number((await SecureStore.getItemAsync(KEY_ATTEMPTS, STORE_OPTS)) ?? '0');
  if (attempts >= MAX_PIN_ATTEMPTS) return { ok: false, attemptsLeft: 0 };
  const record = JSON.parse(stored) as PinRecord;
  const ok = constantTimeEqual(hashPin(pin, base64ToBytes(record.salt), record.iterations), base64ToBytes(record.hash));
  await SecureStore.setItemAsync(KEY_ATTEMPTS, ok ? '0' : String(attempts + 1), STORE_OPTS);
  return ok ? { ok: true } : { ok: false, attemptsLeft: MAX_PIN_ATTEMPTS - attempts - 1 };
}

async function dataKey(): Promise<Uint8Array> {
  const key = await SecureStore.getItemAsync(KEY_DATA, STORE_OPTS);
  if (!key) throw new Error('Wallet is not set up');
  return base64ToBytes(key);
}

export async function load(): Promise<VaultData> {
  const file = vaultFile();
  if (!file.exists) return emptyVault();
  const plain = decrypt(await dataKey(), await file.bytes());
  return { ...emptyVault(), ...(JSON.parse(fromUtf8(plain)) as VaultData) };
}

export async function save(data: VaultData): Promise<void> {
  const sealed = encrypt(await dataKey(), utf8(JSON.stringify(data)));
  const file = vaultFile();
  if (!file.exists) file.create();
  file.write(sealed);
}

/** Erases every credential, key, log entry and the PIN. */
export async function wipe(): Promise<void> {
  const file = vaultFile();
  if (file.exists) file.delete();
  await SecureStore.deleteItemAsync(KEY_DATA, STORE_OPTS);
  await SecureStore.deleteItemAsync(KEY_PIN, STORE_OPTS);
  await SecureStore.deleteItemAsync(KEY_ATTEMPTS, STORE_OPTS);
}

import * as LocalAuthentication from 'expo-local-authentication';
import { getLocales } from 'expo-localization';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { format, strings, type Locale, type StringKey } from '../i18n/strings';
import { randomId } from '../lib/crypto';
import type { LogEntry, Settings, StoredCredential, VaultData } from '../lib/types';
import * as vault from '../lib/vault';

type Status = 'loading' | 'new' | 'locked' | 'lockedOut' | 'unlocked';

type WalletContext = {
  status: Status;
  data: VaultData | null;
  locale: Locale;
  t: (key: StringKey, vars?: Record<string, string | number>) => string;
  biometricsAvailable: boolean;
  setUp: (pin: string) => Promise<void>;
  unlockWithPin: (pin: string) => Promise<vault.PinResult>;
  unlockWithBiometrics: () => Promise<boolean>;
  lock: () => void;
  addCredentials: (creds: StoredCredential[], log: Omit<LogEntry, 'id' | 'at'>) => Promise<void>;
  removeCredential: (id: string) => Promise<void>;
  addLog: (log: Omit<LogEntry, 'id' | 'at'>) => Promise<void>;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  wipe: () => Promise<void>;
};

const Ctx = createContext<WalletContext | null>(null);

function systemLocale(): Locale {
  return getLocales()[0]?.languageCode === 'sl' ? 'sl' : 'en';
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [data, setData] = useState<VaultData | null>(null);
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const dataRef = useRef<VaultData | null>(null);

  useEffect(() => {
    (async () => {
      const [setUp, hasHw, enrolled] = await Promise.all([
        vault.isSetUp(),
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
      ]);
      setBiometricsAvailable(hasHw && enrolled);
      setStatus(setUp ? 'locked' : 'new');
    })().catch(() => setStatus('new'));
  }, []);

  // Lock whenever the app leaves the foreground; decrypted data is dropped from memory.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background') {
        dataRef.current = null;
        setData(null);
        setStatus((cur) => (cur === 'unlocked' ? 'locked' : cur));
      }
    });
    return () => sub.remove();
  }, []);

  const commit = useCallback(async (next: VaultData) => {
    await vault.save(next);
    dataRef.current = next;
    setData(next);
  }, []);

  const open = useCallback(async () => {
    const loaded = await vault.load();
    dataRef.current = loaded;
    setData(loaded);
    setStatus('unlocked');
  }, []);

  const mutate = useCallback(
    async (fn: (d: VaultData) => VaultData) => {
      const cur = dataRef.current;
      if (!cur) throw new Error('Wallet is locked');
      await commit(fn(cur));
    },
    [commit],
  );

  const locale: Locale = data?.settings.locale ?? systemLocale();

  const value = useMemo<WalletContext>(() => {
    const entry = (log: Omit<LogEntry, 'id' | 'at'>): LogEntry => ({ ...log, id: randomId(), at: new Date().toISOString() });
    return {
      status,
      data,
      locale,
      biometricsAvailable,
      t: (key, vars) => format(strings[locale][key], vars),
      setUp: async (pin) => {
        const fresh = await vault.setUp(pin);
        fresh.settings.locale = locale;
        await commit(fresh);
        setStatus('unlocked');
      },
      unlockWithPin: async (pin) => {
        const res = await vault.checkPin(pin);
        if (res.ok) await open();
        else if (res.attemptsLeft === 0) setStatus('lockedOut');
        return res;
      },
      unlockWithBiometrics: async () => {
        const res = await LocalAuthentication.authenticateAsync({
          promptMessage: strings[locale].unlockPrompt,
          cancelLabel: strings[locale].cancel,
          disableDeviceFallback: true,
        });
        if (res.success) await open();
        return res.success;
      },
      lock: () => {
        dataRef.current = null;
        setData(null);
        setStatus('locked');
      },
      addCredentials: (creds, log) =>
        mutate((d) => ({ ...d, credentials: [...d.credentials, ...creds], log: [entry(log), ...d.log] })),
      removeCredential: (id) =>
        mutate((d) => {
          const cred = d.credentials.find((c) => c.id === id);
          return {
            ...d,
            credentials: d.credentials.filter((c) => c.id !== id),
            log: [
              entry({ type: 'deletion', counterparty: cred?.issuer ?? { id: '' }, credentialIds: [id], attributes: [], ok: true }),
              ...d.log,
            ],
          };
        }),
      addLog: (log) => mutate((d) => ({ ...d, log: [entry(log), ...d.log] })),
      updateSettings: (patch) => mutate((d) => ({ ...d, settings: { ...d.settings, ...patch } })),
      wipe: async () => {
        await vault.wipe();
        dataRef.current = null;
        setData(null);
        setStatus('new');
      },
    };
  }, [status, data, locale, biometricsAvailable, commit, open, mutate]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWallet(): WalletContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useWallet outside WalletProvider');
  return ctx;
}

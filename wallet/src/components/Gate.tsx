import Ionicons from '@expo/vector-icons/Ionicons';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useWallet } from '../state/wallet';
import { TriglavMotif } from './Motif';
import { PinPad } from './PinPad';
import { fonts, radius } from './theme';
import type { IconName } from './ui';

const FOREST = '#1D5A3E';
const FOREST_DEEP = '#123C29';
const ON = '#FFFFFF';
const ON_MUTED = 'rgba(255,255,255,0.78)';

/** Shown instead of the app until the wallet is set up and unlocked. */
export function Gate() {
  const w = useWallet();
  const [intro, setIntro] = useState(true);
  return (
    <Backdrop low={!(w.status === 'new' && intro)}>
      {w.status === 'loading' ? <ActivityIndicator color={ON} style={{ flex: 1 }} /> : w.status === 'new' ? <Onboarding onLeaveIntro={() => setIntro(false)} /> : <Unlock />}
    </Backdrop>
  );
}

function Backdrop({ children, low }: { children: ReactNode; low?: boolean }) {
  const { width } = useWindowDimensions();
  return (
    <View style={[styles.fill, { backgroundColor: FOREST }]}>
      <StatusBar style="light" />
      <View style={styles.motif} pointerEvents="none">
        <TriglavMotif width={width} height={low ? 96 : undefined} opacity={low ? 0.1 : 0.14} fillPeaks color={ON} />
      </View>
      <SafeAreaView style={styles.fill}>{children}</SafeAreaView>
    </View>
  );
}

function Point({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View style={styles.point}>
      <View style={styles.pointIcon}>
        <Ionicons name={icon} size={20} color={ON} />
      </View>
      <Text style={styles.pointText}>{text}</Text>
    </View>
  );
}

function LightButton({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.lightButton, { opacity: pressed ? 0.85 : 1 }]}
    >
      <Text style={styles.lightButtonText}>{title}</Text>
    </Pressable>
  );
}

function Onboarding({ onLeaveIntro }: { onLeaveIntro: () => void }) {
  const w = useWallet();
  const [step, setStep] = useState<'intro' | 'pin' | 'confirm'>('intro');
  const [first, setFirst] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (step === 'intro') {
    return (
      <View style={styles.page}>
        <View style={styles.brand}>
          <Text style={styles.wordmark}>SI Wallet</Text>
          <Text style={styles.demoPill}>{w.t('demoShort')}</Text>
        </View>
        <Text style={styles.hero}>{w.t('welcomeTitle')}</Text>
        <Text style={styles.lead}>{w.t('welcomeBody')}</Text>
        <View style={styles.points}>
          <Point icon="phone-portrait-outline" text={w.t('point1')} />
          <Point icon="hand-left-outline" text={w.t('point2')} />
          <Point icon="eye-outline" text={w.t('point3')} />
        </View>
        <View style={{ flex: 1 }} />
        <LightButton
          title={w.t('getStarted')}
          onPress={() => {
            onLeaveIntro();
            setStep('pin');
          }}
        />
      </View>
    );
  }
  return (
    <View style={[styles.page, styles.center]}>
      <Ionicons name="lock-closed-outline" size={32} color={ON} />
      <Text style={styles.pinTitle}>{step === 'pin' ? w.t('createPin') : w.t('confirmPin')}</Text>
      <Text style={[styles.pinError, { opacity: error ? 1 : 0 }]}>{error || ' '}</Text>
      <PinPad
        disabled={busy}
        onComplete={async (pin) => {
          if (step === 'pin') {
            setFirst(pin);
            setError('');
            setStep('confirm');
          } else if (pin !== first) {
            setError(w.t('pinMismatch'));
            setStep('pin');
          } else {
            setBusy(true);
            await w.setUp(pin);
          }
        }}
      />
      <View style={{ height: 24 }}>{busy ? <ActivityIndicator color={ON} /> : null}</View>
    </View>
  );
}

function Unlock() {
  const w = useWallet();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const tried = useRef(false);
  const useBio = w.biometricsAvailable && w.status === 'locked';

  useEffect(() => {
    if (useBio && !tried.current) {
      tried.current = true;
      w.unlockWithBiometrics().catch(() => {});
    }
  }, [useBio, w]);

  if (w.status === 'lockedOut') {
    return (
      <View style={[styles.page, styles.center]}>
        <Ionicons name="alert-circle-outline" size={40} color={ON} />
        <Text style={styles.pinTitle}>{w.t('lockedOut')}</Text>
        <LightButton
          title={w.t('resetWallet')}
          onPress={() =>
            Alert.alert(w.t('resetWallet'), w.t('wipeConfirm'), [
              { text: w.t('cancel'), style: 'cancel' },
              { text: w.t('delete'), style: 'destructive', onPress: () => w.wipe() },
            ])
          }
        />
      </View>
    );
  }

  return (
    <View style={[styles.page, styles.center]}>
      <Text style={styles.wordmark}>SI Wallet</Text>
      <Text style={styles.pinTitle}>{w.t('enterPin')}</Text>
      <Text style={[styles.pinError, { opacity: error ? 1 : 0 }]}>{error || ' '}</Text>
      <PinPad
        disabled={busy}
        onComplete={async (pin) => {
          setBusy(true);
          const res = await w.unlockWithPin(pin);
          setBusy(false);
          if (!res.ok) setError(w.t('wrongPin', { n: res.attemptsLeft }));
        }}
      />
      <View style={{ height: 52, justifyContent: 'center' }}>
        {busy ? (
          <ActivityIndicator color={ON} />
        ) : useBio ? (
          <Pressable accessibilityRole="button" onPress={() => w.unlockWithBiometrics()} style={styles.bio} hitSlop={10}>
            <Ionicons name="scan-outline" size={22} color={ON} />
            <Text style={styles.bioText}>{w.t('useBiometrics')}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  motif: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  page: { flex: 1, paddingHorizontal: 28, paddingVertical: 20, gap: 14 },
  center: { alignItems: 'center', justifyContent: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 },
  wordmark: { color: ON, fontFamily: fonts.serif, fontSize: 22 },
  demoPill: {
    color: ON,
    fontFamily: fonts.medium,
    fontSize: 12,
    borderColor: 'rgba(255,255,255,0.5)',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  hero: { color: ON, fontFamily: fonts.serif, fontSize: 38, lineHeight: 44 },
  lead: { color: ON_MUTED, fontFamily: fonts.regular, fontSize: 17, lineHeight: 25 },
  points: { gap: 14, marginTop: 18 },
  point: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  pointIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  pointText: { flex: 1, color: ON, fontFamily: fonts.regular, fontSize: 16, lineHeight: 22 },
  lightButton: { backgroundColor: ON, minHeight: 56, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
  lightButtonText: { color: FOREST_DEEP, fontFamily: fonts.bold, fontSize: 17 },
  pinTitle: { color: ON, fontFamily: fonts.serif, fontSize: 26, textAlign: 'center', marginTop: 8 },
  pinError: { color: '#FFE2A8', fontFamily: fonts.medium, fontSize: 15, textAlign: 'center', minHeight: 20 },
  bio: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bioText: { color: ON, fontFamily: fonts.medium, fontSize: 16 },
});

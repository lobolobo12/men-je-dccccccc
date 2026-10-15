import Ionicons from '@expo/vector-icons/Ionicons';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useWallet } from '../state/wallet';
import { TriglavMotif } from './Motif';
import { PinPad } from './PinPad';
import { fonts, radius, useTheme, type Theme } from './theme';
import type { IconName } from './ui';

const SKY: [string, string] = ['#2350D8', '#16A89C'];

/** Shown instead of the app until the wallet is set up and unlocked. */
export function Gate() {
  const w = useWallet();
  const [intro, setIntro] = useState(true);
  return (
    <Backdrop low={!(w.status === 'new' && intro)}>
      {w.status === 'loading' ? <ActivityIndicator style={{ flex: 1 }} /> : w.status === 'new' ? <Onboarding onLeaveIntro={() => setIntro(false)} /> : <Unlock />}
    </Backdrop>
  );
}

function Backdrop({ children, low }: { children: ReactNode; low?: boolean }) {
  const { width } = useWindowDimensions();
  const t = useTheme();
  return (
    <View style={[styles.fill, { backgroundColor: t.gateBg }]}>
      <StatusBar style="auto" />
      <View style={styles.motif} pointerEvents="none">
        <TriglavMotif width={width} height={low ? 96 : undefined} opacity={low ? 0.14 : 0.22} fillPeaks colors={SKY} />
      </View>
      <SafeAreaView style={styles.fill}>{children}</SafeAreaView>
    </View>
  );
}

function Point({ icon, text, tint, color }: { icon: IconName; text: string; tint: string; color: string }) {
  const t = useTheme();
  return (
    <View style={styles.point}>
      <View style={[styles.pointIcon, { backgroundColor: tint }]}>
        <Ionicons name={icon} size={21} color={color} />
      </View>
      <Text style={[styles.pointText, { color: t.text }]}>{text}</Text>
    </View>
  );
}

function MainButton({ title, onPress }: { title: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.mainButton, { backgroundColor: t.primary, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
    >
      <Text style={[styles.mainButtonText, { color: t.primaryText }]}>{title}</Text>
    </Pressable>
  );
}

function Onboarding({ onLeaveIntro }: { onLeaveIntro: () => void }) {
  const w = useWallet();
  const t = useTheme();
  const st = themed(t);
  const [step, setStep] = useState<'intro' | 'pin' | 'confirm'>('intro');
  const [first, setFirst] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (step === 'intro') {
    return (
      <View style={styles.page}>
        <View style={styles.brand}>
          <Text style={st.wordmark}>SI Wallet</Text>
          <Text style={st.demoPill}>{w.t('demoShort')}</Text>
        </View>
        <Text style={st.hero}>{w.t('welcomeTitle')}</Text>
        <Text style={st.lead}>{w.t('welcomeBody')}</Text>
        <View style={styles.points}>
          <Point icon="phone-portrait-outline" text={w.t('point1')} tint={t.blueTint} color={t.primary} />
          <Point icon="hand-left-outline" text={w.t('point2')} tint={t.greenTint} color={t.green} />
          <Point icon="eye-outline" text={w.t('point3')} tint={t.warnBg} color={t.warnText} />
        </View>
        <View style={{ flex: 1 }} />
        <MainButton
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
      <View style={[styles.lockBadge, { backgroundColor: t.blueTint }]}>
        <Ionicons name="lock-closed" size={26} color={t.primary} />
      </View>
      <Text style={st.pinTitle}>{step === 'pin' ? w.t('createPin') : w.t('confirmPin')}</Text>
      <Text style={[st.pinError, { opacity: error ? 1 : 0 }]}>{error || ' '}</Text>
      <PinPad
        color={t.text}
        keyColor={t.blueTint}
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
      <View style={{ height: 24 }}>{busy ? <ActivityIndicator color={t.primary} /> : null}</View>
    </View>
  );
}

function Unlock() {
  const w = useWallet();
  const t = useTheme();
  const st = themed(t);
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
        <Ionicons name="alert-circle-outline" size={40} color={t.danger} />
        <Text style={st.pinTitle}>{w.t('lockedOut')}</Text>
        <MainButton
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
      <Text style={st.wordmark}>SI Wallet</Text>
      <Text style={st.pinTitle}>{w.t('enterPin')}</Text>
      <Text style={[st.pinError, { opacity: error ? 1 : 0 }]}>{error || ' '}</Text>
      <PinPad
        color={t.text}
        keyColor={t.blueTint}
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
          <ActivityIndicator color={t.primary} />
        ) : useBio ? (
          <Pressable accessibilityRole="button" onPress={() => w.unlockWithBiometrics()} style={styles.bio} hitSlop={10}>
            <Ionicons name="scan-outline" size={22} color={t.primary} />
            <Text style={[styles.bioText, { color: t.primary }]}>{w.t('useBiometrics')}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const themed = (t: Theme) =>
  StyleSheet.create({
    wordmark: { color: t.primary, fontFamily: fonts.display, fontSize: 20 },
    demoPill: {
      color: t.warnText,
      backgroundColor: t.warnBg,
      fontFamily: fonts.bold,
      fontSize: 12,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 5,
      overflow: 'hidden',
    },
    hero: { color: t.text, fontFamily: fonts.display, fontSize: 38, lineHeight: 44, letterSpacing: -0.8 },
    lead: { color: t.muted, fontFamily: fonts.regular, fontSize: 17, lineHeight: 25 },
    pinTitle: { color: t.text, fontFamily: fonts.display, fontSize: 24, textAlign: 'center', marginTop: 8, letterSpacing: -0.3 },
    pinError: { color: t.danger, fontFamily: fonts.medium, fontSize: 15, textAlign: 'center', minHeight: 20 },
  });

const styles = StyleSheet.create({
  fill: { flex: 1 },
  motif: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  page: { flex: 1, paddingHorizontal: 28, paddingVertical: 20, gap: 14 },
  center: { alignItems: 'center', justifyContent: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 },
  points: { gap: 14, marginTop: 18 },
  point: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  pointIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  pointText: { flex: 1, fontFamily: fonts.medium, fontSize: 16, lineHeight: 22 },
  mainButton: { minHeight: 56, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
  mainButtonText: { fontFamily: fonts.bold, fontSize: 17 },
  lockBadge: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  bio: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bioText: { fontFamily: fonts.bold, fontSize: 16 },
});

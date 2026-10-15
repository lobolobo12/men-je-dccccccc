import Ionicons from '@expo/vector-icons/Ionicons';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useWallet } from '../state/wallet';
import { TriglavMotif } from './Motif';
import { PinPad } from './PinPad';
import { fonts, night, radius } from './theme';
import type { IconName } from './ui';

/** Start, PIN setup and unlock: deep night blue with Triglav in gold. Shown until the wallet is unlocked. */
export function Gate() {
  const w = useWallet();
  const [intro, setIntro] = useState(true);
  return (
    <Night low={!(w.status === 'new' && intro)}>
      {w.status === 'loading' ? (
        <ActivityIndicator color={night.gold} style={{ flex: 1 }} />
      ) : w.status === 'new' ? (
        <Onboarding onLeaveIntro={() => setIntro(false)} />
      ) : (
        <Unlock />
      )}
    </Night>
  );
}

// A few fixed stars above the mountain; positions are fractions of the screen.
const STARS = [
  [0.12, 0.08, 1.4],
  [0.3, 0.16, 1],
  [0.52, 0.06, 1.6],
  [0.74, 0.12, 1.1],
  [0.88, 0.22, 1.3],
  [0.64, 0.27, 0.9],
  [0.2, 0.33, 1],
];

function Night({ children, low }: { children: ReactNode; low?: boolean }) {
  const { width, height } = useWindowDimensions();
  return (
    <View style={[styles.fill, { backgroundColor: night.from }]}>
      <StatusBar style="light" />
      <Svg style={StyleSheet.absoluteFill} width={width} height={height}>
        <Defs>
          <LinearGradient id="night" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={night.from} />
            <Stop offset="1" stopColor={night.to} />
          </LinearGradient>
        </Defs>
        <Rect width={width} height={height} fill="url(#night)" />
        {STARS.map(([x, y, r], i) => (
          <Circle key={i} cx={x * width} cy={y * height} r={r * 1.4} fill={night.goldLight} opacity={0.9} />
        ))}
      </Svg>
      <View style={styles.motif} pointerEvents="none">
        <TriglavMotif
          width={width}
          height={height * (low ? 0.1 : 0.2)}
          colors={[night.gold, night.goldLight]}
          opacity={0.6}
          strokeWidth={3}
          fill={night.from}
        />
      </View>
      <SafeAreaView style={styles.fill}>{children}</SafeAreaView>
    </View>
  );
}

function Point({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View style={styles.point}>
      <View style={styles.pointIcon}>
        <Ionicons name={icon} size={21} color={night.gold} />
      </View>
      <Text style={styles.pointText}>{text}</Text>
    </View>
  );
}

function GoldButton({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.goldButton, { transform: [{ scale: pressed ? 0.98 : 1 }], opacity: pressed ? 0.9 : 1 }]}
    >
      <Text style={styles.goldButtonText}>{title}</Text>
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
        <GoldButton
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
      <View style={styles.lockBadge}>
        <Ionicons name="lock-closed" size={26} color={night.gold} />
      </View>
      <Text style={styles.pinTitle}>{step === 'pin' ? w.t('createPin') : w.t('confirmPin')}</Text>
      <Text style={[styles.pinError, { opacity: error ? 1 : 0 }]}>{error || ' '}</Text>
      <PinPad
        color={night.text}
        dotColor={night.gold}
        keyColor="rgba(255,255,255,0.1)"
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
      <View style={{ height: 24 }}>{busy ? <ActivityIndicator color={night.gold} /> : null}</View>
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
        <Ionicons name="alert-circle-outline" size={40} color={night.gold} />
        <Text style={styles.pinTitle}>{w.t('lockedOut')}</Text>
        <GoldButton
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
        color={night.text}
        dotColor={night.gold}
        keyColor="rgba(255,255,255,0.1)"
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
          <ActivityIndicator color={night.gold} />
        ) : useBio ? (
          <Pressable accessibilityRole="button" onPress={() => w.unlockWithBiometrics()} style={styles.bio} hitSlop={10}>
            <Ionicons name="scan-outline" size={22} color={night.gold} />
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
  wordmark: { color: night.gold, fontFamily: fonts.display, fontSize: 20 },
  demoPill: {
    color: night.text,
    borderColor: 'rgba(242,193,78,0.6)',
    borderWidth: 1,
    fontFamily: fonts.bold,
    fontSize: 12,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    overflow: 'hidden',
  },
  hero: { color: night.text, fontFamily: fonts.display, fontSize: 38, lineHeight: 44, letterSpacing: -0.8 },
  lead: { color: night.muted, fontFamily: fonts.regular, fontSize: 17, lineHeight: 25 },
  points: { gap: 14, marginTop: 18 },
  point: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  pointIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(242,193,78,0.14)', alignItems: 'center', justifyContent: 'center' },
  pointText: { flex: 1, color: night.text, fontFamily: fonts.medium, fontSize: 16, lineHeight: 22 },
  goldButton: { minHeight: 56, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center', backgroundColor: night.gold },
  goldButtonText: { color: night.from, fontFamily: fonts.bold, fontSize: 17 },
  lockBadge: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(242,193,78,0.14)', alignItems: 'center', justifyContent: 'center' },
  pinTitle: { color: night.text, fontFamily: fonts.display, fontSize: 24, textAlign: 'center', marginTop: 8, letterSpacing: -0.3 },
  pinError: { color: night.goldLight, fontFamily: fonts.medium, fontSize: 15, textAlign: 'center', minHeight: 20 },
  bio: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bioText: { color: night.gold, fontFamily: fonts.bold, fontSize: 16 },
});

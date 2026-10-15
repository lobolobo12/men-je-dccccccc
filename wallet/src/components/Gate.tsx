import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useWallet } from '../state/wallet';
import { PinPad } from './PinPad';
import { useTheme } from './theme';
import { Banner, Body, Button, Title } from './ui';

/** Shown instead of the app until the wallet is set up and unlocked. */
export function Gate() {
  const w = useWallet();
  const t = useTheme();
  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: t.bg }]}>
      {w.status === 'loading' ? <ActivityIndicator style={styles.fill} /> : w.status === 'new' ? <Onboarding /> : <Unlock />}
    </SafeAreaView>
  );
}

function Onboarding() {
  const w = useWallet();
  const [step, setStep] = useState<'intro' | 'pin' | 'confirm'>('intro');
  const [first, setFirst] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (step === 'intro') {
    return (
      <View style={styles.page}>
        <Title>{w.t('welcomeTitle')}</Title>
        <Body>{w.t('welcomeBody')}</Body>
        <Body muted>{w.t('welcomePoints')}</Body>
        <Banner text={w.t('demoNotice')} />
        <View style={{ flex: 1 }} />
        <Button title={w.t('getStarted')} onPress={() => setStep('pin')} />
      </View>
    );
  }
  return (
    <View style={[styles.page, styles.center]}>
      <Title>{step === 'pin' ? w.t('createPin') : w.t('confirmPin')}</Title>
      {error ? <Text style={{ color: '#B42318' }}>{error}</Text> : null}
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
      {busy ? <ActivityIndicator /> : null}
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
        <Title>{w.t('lockedOut')}</Title>
        <Button
          variant="danger"
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
      <Title>{w.t('enterPin')}</Title>
      {error ? <Text style={{ color: '#B42318' }}>{error}</Text> : null}
      <PinPad
        disabled={busy}
        onComplete={async (pin) => {
          setBusy(true);
          const res = await w.unlockWithPin(pin);
          setBusy(false);
          if (!res.ok) setError(w.t('wrongPin', { n: res.attemptsLeft }));
        }}
      />
      {busy ? <ActivityIndicator /> : null}
      {useBio ? <Button variant="secondary" title={w.t('useBiometrics')} onPress={() => w.unlockWithBiometrics()} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  page: { flex: 1, padding: 24, gap: 16 },
  center: { alignItems: 'center', justifyContent: 'center' },
});

import '../lib/polyfills';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Gate } from '../components/Gate';
import { useTheme } from '../components/theme';
import { useWallet, WalletProvider } from '../state/wallet';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <WalletProvider>
        <StatusBar style="auto" />
        <Root />
      </WalletProvider>
    </SafeAreaProvider>
  );
}

function Root() {
  const w = useWallet();
  const t = useTheme();
  if (w.status !== 'unlocked') return <Gate />;
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: t.surface },
        headerTintColor: t.primary,
        headerTitleStyle: { color: t.text },
        contentStyle: { backgroundColor: t.bg },
        headerBackButtonDisplayMode: 'minimal',
      }}
    >
      <Stack.Screen name="index" options={{ title: w.t('appName') }} />
      <Stack.Screen name="scan" options={{ title: w.t('scanTitle'), presentation: 'modal' }} />
      <Stack.Screen name="offer" options={{ title: w.t('offerTitle') }} />
      <Stack.Screen name="request" options={{ title: w.t('requestTitle') }} />
      <Stack.Screen name="credential/[id]" options={{ title: w.t('details') }} />
      <Stack.Screen name="activity" options={{ title: w.t('activityTitle') }} />
      <Stack.Screen name="settings" options={{ title: w.t('settings') }} />
    </Stack>
  );
}

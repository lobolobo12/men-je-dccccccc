import '../lib/polyfills';
import { AtkinsonHyperlegibleNext_400Regular } from '@expo-google-fonts/atkinson-hyperlegible-next/400Regular';
import { AtkinsonHyperlegibleNext_500Medium } from '@expo-google-fonts/atkinson-hyperlegible-next/500Medium';
import { AtkinsonHyperlegibleNext_700Bold } from '@expo-google-fonts/atkinson-hyperlegible-next/700Bold';
import { SourceSerif4_600SemiBold } from '@expo-google-fonts/source-serif-4/600SemiBold';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Gate } from '../components/Gate';
import { fonts, useTheme } from '../components/theme';
import { useWallet, WalletProvider } from '../state/wallet';

export default function RootLayout() {
  const [loaded] = useFonts({
    AtkinsonHyperlegibleNext_400Regular,
    AtkinsonHyperlegibleNext_500Medium,
    AtkinsonHyperlegibleNext_700Bold,
    SourceSerif4_600SemiBold,
  });
  if (!loaded) return <View style={{ flex: 1, backgroundColor: '#1D5A3E' }} />;
  return (
    <SafeAreaProvider>
      <WalletProvider>
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
    <>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: t.bg },
          headerShadowVisible: false,
          headerTintColor: t.primary,
          headerTitleStyle: { color: t.text, fontFamily: fonts.bold, fontSize: 17 },
          contentStyle: { backgroundColor: t.bg },
          headerBackButtonDisplayMode: 'minimal',
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="scan" options={{ title: w.t('scanTitle'), presentation: 'modal' }} />
        <Stack.Screen name="offer" options={{ title: w.t('offerTitle') }} />
        <Stack.Screen name="request" options={{ title: w.t('requestTitle') }} />
        <Stack.Screen name="credential/[id]" options={{ title: '' }} />
        <Stack.Screen name="activity" options={{ title: w.t('activityTitle') }} />
        <Stack.Screen name="settings" options={{ title: w.t('settings') }} />
      </Stack>
    </>
  );
}

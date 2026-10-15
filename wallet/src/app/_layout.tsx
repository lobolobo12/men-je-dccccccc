import '../lib/polyfills';
import { AtkinsonHyperlegibleNext_400Regular } from '@expo-google-fonts/atkinson-hyperlegible-next/400Regular';
import { AtkinsonHyperlegibleNext_500Medium } from '@expo-google-fonts/atkinson-hyperlegible-next/500Medium';
import { AtkinsonHyperlegibleNext_700Bold } from '@expo-google-fonts/atkinson-hyperlegible-next/700Bold';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import { PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans/800ExtraBold';
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
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });
  if (!loaded) return <View style={{ flex: 1, backgroundColor: '#F6F8FC' }} />;
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
          headerTitleStyle: { color: t.text, fontFamily: fonts.heading, fontSize: 17 },
          contentStyle: { backgroundColor: t.bg },
          headerBackButtonDisplayMode: 'minimal',
          headerShown: false,
        }}
      >
        {/* Every screen draws its own coloured Hero header instead of a navigation bar. */}
        <Stack.Screen name="index" />
        <Stack.Screen name="scan" />
        <Stack.Screen name="offer" />
        <Stack.Screen name="request" />
        <Stack.Screen name="credential/[id]" />
        <Stack.Screen name="activity" />
        <Stack.Screen name="settings" />
      </Stack>
    </>
  );
}

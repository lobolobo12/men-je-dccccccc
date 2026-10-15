import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { Alert } from 'react-native';
import { Hero } from '../components/Hero';
import { heroColors, useTheme } from '../components/theme';
import { Body, Card, ListRow, Screen, Section } from '../components/ui';
import { makeDemoCredentials } from '../lib/demo';
import { useWallet } from '../state/wallet';

export default function Settings() {
  const w = useWallet();
  const t = useTheme();
  const current = w.data?.settings.locale ?? null;
  const languages = [
    ['sl', 'Slovenščina'],
    ['en', 'English'],
    [null, w.t('languageSystem')],
  ] as const;

  return (
    <Screen header={<Hero colors={heroColors.settings} icon="settings-outline" title={w.t('settings')} subtitle={w.t('settingsSubtitle')} />}>
      <Section>{w.t('language')}</Section>
      <Card padded={false}>
        {languages.map(([value, title], i) => (
          <ListRow
            key={String(value)}
            title={title}
            onPress={() => w.updateSettings({ locale: value })}
            right={current === value ? <Ionicons name="checkmark" size={22} color={t.primary} /> : <></>}
            last={i === languages.length - 1}
          />
        ))}
      </Card>

      <Section>{w.t('myDocuments')}</Section>
      <Card padded={false}>
        <ListRow
          icon="sparkles-outline"
          title={w.t('addDemo')}
          onPress={async () => {
            await w.addCredentials(makeDemoCredentials(), {
              type: 'issuance',
              counterparty: { id: 'https://demo.si-wallet.invalid', name: 'SI Wallet DEMO' },
              credentialIds: [],
              attributes: [],
              ok: true,
            });
            Alert.alert(w.t('demoAdded'));
          }}
        />
        <ListRow
          icon="download-outline"
          title={w.t('exportData')}
          onPress={async () => {
            // Data portability: credentials as issued, plus the activity log. Private keys are not exported.
            const data = w.data!;
            const exported = {
              exportedAt: new Date().toISOString(),
              credentials: data.credentials.map(({ holderKey, ...c }) => ({ ...c, holderPublicKey: holderKey.publicJwk })),
              log: data.log,
            };
            await Clipboard.setStringAsync(JSON.stringify(exported, null, 2));
            Alert.alert(w.t('exportDone'));
          }}
          last
        />
      </Card>

      <Section>{w.t('security')}</Section>
      <Card padded={false}>
        <ListRow icon="lock-closed-outline" title={w.t('lockNow')} onPress={w.lock} />
        <ListRow
          icon="trash-outline"
          tint={t.danger}
          title={w.t('wipeAll')}
          onPress={() =>
            Alert.alert(w.t('wipeAll'), w.t('wipeConfirm'), [
              { text: w.t('cancel'), style: 'cancel' },
              { text: w.t('delete'), style: 'destructive', onPress: () => w.wipe() },
            ])
          }
          last
        />
      </Card>

      <Section>{w.t('about')}</Section>
      <Card>
        <Body muted>{w.t('aboutBody')}</Body>
      </Card>
    </Screen>
  );
}

import * as Clipboard from 'expo-clipboard';
import { Alert, StyleSheet, View } from 'react-native';
import { Body, Button, Card, Label, Screen } from '../components/ui';
import { makeDemoCredentials } from '../lib/demo';
import { useWallet } from '../state/wallet';

export default function Settings() {
  const w = useWallet();
  const current = w.data?.settings.locale ?? null;
  const pick = (locale: 'sl' | 'en' | null) => w.updateSettings({ locale });

  return (
    <Screen>
      <Label>{w.t('language')}</Label>
      <View style={styles.row}>
        {([['sl', 'Slovenščina'], ['en', 'English'], [null, w.t('languageSystem')]] as const).map(([value, title]) => (
          <View key={String(value)} style={styles.flex}>
            <Button title={title} variant={current === value ? 'primary' : 'secondary'} onPress={() => pick(value)} />
          </View>
        ))}
      </View>

      <Label>{w.t('myDocuments')}</Label>
      <Button
        variant="secondary"
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
      <Button
        variant="secondary"
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
      />
      <Button
        variant="danger"
        title={w.t('wipeAll')}
        onPress={() =>
          Alert.alert(w.t('wipeAll'), w.t('wipeConfirm'), [
            { text: w.t('cancel'), style: 'cancel' },
            { text: w.t('delete'), style: 'destructive', onPress: () => w.wipe() },
          ])
        }
      />
      <Button variant="secondary" title={w.t('lockNow')} onPress={w.lock} />

      <Label>{w.t('about')}</Label>
      <Card>
        <Body>{w.t('aboutBody')}</Body>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
});

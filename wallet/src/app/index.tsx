import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { CredentialCard } from '../components/CredentialCard';
import { TriglavMotif } from '../components/Motif';
import { fonts, radius, useTheme } from '../components/theme';
import { Body, Button, Card, IconButton, ListRow, Screen, Section, Title, type IconName } from '../components/ui';
import { makeDemoCredentials } from '../lib/demo';
import { useWallet } from '../state/wallet';

function ActionTile({ icon, label, onPress, filled }: { icon: IconName; label: string; onPress: () => void; filled?: boolean }) {
  const t = useTheme();
  const fg = filled ? t.primaryText : t.primary;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        {
          backgroundColor: filled ? t.primary : t.surface,
          borderColor: filled ? t.primary : t.border,
          transform: [{ scale: pressed ? 0.97 : 1 }],
        },
      ]}
    >
      <Ionicons name={icon} size={26} color={fg} />
      <Text style={[styles.tileText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export default function Home() {
  const w = useWallet();
  const t = useTheme();
  const { width } = useWindowDimensions();
  const creds = w.data?.credentials ?? [];
  const lastActivity = w.data?.log[0];

  const addDemo = () =>
    w.addCredentials(makeDemoCredentials(), {
      type: 'issuance',
      counterparty: { id: 'https://demo.si-wallet.invalid', name: 'SI Wallet DEMO' },
      credentialIds: [],
      attributes: [],
      ok: true,
    });

  return (
    <Screen edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.wordmark, { color: t.primary }]}>SI Wallet</Text>
          <Title size={32}>{w.t('homeTitle')}</Title>
        </View>
        <IconButton icon="settings-outline" label={w.t('settings')} onPress={() => router.push('/settings')} />
      </View>

      <View style={styles.tiles}>
        <ActionTile filled icon="add-circle-outline" label={w.t('addDocument')} onPress={() => router.push({ pathname: '/scan', params: { mode: 'add' } })} />
        <ActionTile icon="qr-code-outline" label={w.t('presentData')} onPress={() => router.push({ pathname: '/scan', params: { mode: 'share' } })} />
      </View>

      {creds.length === 0 ? (
        <Card>
          <View style={styles.empty}>
            <TriglavMotif width={width - 72} color={t.primary} opacity={0.35} strokeWidth={2} />
            <Title size={22}>{w.t('emptyTitle')}</Title>
            <Body muted center>
              {w.t('emptyBody')}
            </Body>
            <Button variant="secondary" icon="sparkles-outline" title={w.t('tryDemo')} onPress={addDemo} />
          </View>
        </Card>
      ) : (
        <>
          <Section>{w.t('myDocuments')}</Section>
          {creds.map((c) => (
            <CredentialCard key={c.id} credential={c} onPress={() => router.push({ pathname: '/credential/[id]', params: { id: c.id } })} />
          ))}
        </>
      )}

      <Card padded={false}>
        <ListRow
          icon="time-outline"
          title={w.t('activity')}
          subtitle={lastActivity ? `${w.t(`log_${lastActivity.type}`)}: ${lastActivity.counterparty.name ?? lastActivity.counterparty.id}` : w.t('activityEmpty')}
          onPress={() => router.push('/activity')}
          last
        />
      </Card>

      <Text style={[styles.footnote, { color: t.muted }]}>{w.t('demoNotice')}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginTop: 8, marginBottom: 6 },
  wordmark: { fontFamily: fonts.bold, fontSize: 14, marginBottom: 2 },
  tiles: { flexDirection: 'row', gap: 12 },
  tile: { flex: 1, borderRadius: radius.card - 4, borderWidth: 1, padding: 16, minHeight: 104, justifyContent: 'space-between' },
  tileText: { fontFamily: fonts.bold, fontSize: 16 },
  empty: { alignItems: 'center', gap: 12, paddingVertical: 8 },
  footnote: { fontFamily: fonts.regular, fontSize: 12, textAlign: 'center', marginTop: 6 },
});

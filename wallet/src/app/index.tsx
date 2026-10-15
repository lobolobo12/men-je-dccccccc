import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { CredentialCard } from '../components/CredentialCard';
import { Banner, Body, Button, Card, Label, Screen, Title } from '../components/ui';
import { useWallet } from '../state/wallet';

export default function Home() {
  const w = useWallet();
  const creds = w.data?.credentials ?? [];
  return (
    <Screen>
      <Banner text={w.t('demoNotice')} />
      <View style={styles.actions}>
        <View style={styles.action}>
          <Button title={w.t('add')} onPress={() => router.push({ pathname: '/scan', params: { mode: 'add' } })} />
        </View>
        <View style={styles.action}>
          <Button title={w.t('share')} variant="secondary" onPress={() => router.push({ pathname: '/scan', params: { mode: 'share' } })} />
        </View>
      </View>
      <Label>{w.t('myDocuments')}</Label>
      {creds.length === 0 ? (
        <Card>
          <Title>{w.t('emptyTitle')}</Title>
          <Body muted>{w.t('emptyBody')}</Body>
        </Card>
      ) : (
        creds.map((c) => (
          <CredentialCard key={c.id} credential={c} onPress={() => router.push({ pathname: '/credential/[id]', params: { id: c.id } })} />
        ))
      )}
      <View style={styles.actions}>
        <View style={styles.action}>
          <Button title={w.t('activity')} variant="secondary" onPress={() => router.push('/activity')} />
        </View>
        <View style={styles.action}>
          <Button title={w.t('settings')} variant="secondary" onPress={() => router.push('/settings')} />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: 12 },
  action: { flex: 1 },
});

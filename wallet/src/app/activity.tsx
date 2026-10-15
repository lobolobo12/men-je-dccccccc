import Ionicons from '@expo/vector-icons/Ionicons';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { fonts, useTheme } from '../components/theme';
import { Body, Button, Card, Notice, Screen, type IconName } from '../components/ui';
import type { LogEntry } from '../lib/types';
import { useWallet } from '../state/wallet';

// Art. 5a(4)(d)-(e) eIDAS: the user sees every transaction and can report a relying party
// to the data protection authority (in Slovenia: Informacijski pooblaščenec).
const DPA_URL = 'https://www.ip-rs.si/';

const ICONS: Record<LogEntry['type'], IconName> = {
  issuance: 'download-outline',
  presentation: 'share-outline',
  presentation_declined: 'close-circle-outline',
  deletion: 'trash-outline',
};

export default function Activity() {
  const w = useWallet();
  const t = useTheme();
  const log = w.data?.log ?? [];
  if (log.length === 0) {
    return (
      <Screen>
        <Notice tone="info" text={w.t('activityEmpty')} />
      </Screen>
    );
  }
  return (
    <Screen>
      {log.map((e) => (
        <Card key={e.id}>
          <View style={styles.head}>
            <View style={[styles.icon, { backgroundColor: t.sunken }]}>
              <Ionicons name={ICONS[e.type]} size={20} color={e.ok ? t.primary : t.danger} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.type, { color: e.ok ? t.text : t.danger }]}>{w.t(`log_${e.type}`)}</Text>
              <Text style={[styles.time, { color: t.muted }]}>
                {new Date(e.at).toLocaleString(w.locale === 'sl' ? 'sl-SI' : 'en-GB')}
              </Text>
            </View>
          </View>
          <Body>{e.counterparty.name ?? e.counterparty.id}</Body>
          {e.attributes.length ? <Body muted>{e.attributes.join(', ')}</Body> : null}
          {e.detail ? <Body muted>{e.detail}</Body> : null}
          {e.type === 'presentation' ? (
            <View style={{ marginTop: 6 }}>
              <Button variant="ghost" icon="flag-outline" title={w.t('reportToDpa')} onPress={() => Linking.openURL(DPA_URL)} />
            </View>
          ) : null}
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
  icon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  type: { fontFamily: fonts.bold, fontSize: 16 },
  time: { fontFamily: fonts.regular, fontSize: 13, marginTop: 1 },
});

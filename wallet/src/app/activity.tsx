import { Linking, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../components/theme';
import { Body, Button, Card, Screen } from '../components/ui';
import type { StringKey } from '../i18n/strings';
import { useWallet } from '../state/wallet';

// Art. 5a(4)(d)-(e) eIDAS: the user sees every transaction and can report a relying party
// to the data protection authority (in Slovenia: Informacijski pooblaščenec).
const DPA_URL = 'https://www.ip-rs.si/';

export default function Activity() {
  const w = useWallet();
  const t = useTheme();
  const log = w.data?.log ?? [];
  if (log.length === 0) {
    return (
      <Screen>
        <Body muted>{w.t('activityEmpty')}</Body>
      </Screen>
    );
  }
  return (
    <Screen>
      {log.map((e) => (
        <Card key={e.id}>
          <View style={styles.head}>
            <Text style={[styles.type, { color: e.ok ? t.text : t.danger }]}>{w.t(`log_${e.type}` as StringKey)}</Text>
            <Text style={{ color: t.muted, fontSize: 13 }}>{new Date(e.at).toLocaleString(w.locale === 'sl' ? 'sl-SI' : 'en-GB')}</Text>
          </View>
          <Text style={{ color: t.text }}>{e.counterparty.name ?? e.counterparty.id}</Text>
          {e.attributes.length ? <Text style={{ color: t.muted }}>{e.attributes.join(', ')}</Text> : null}
          {e.detail ? <Text style={{ color: t.muted }}>{e.detail}</Text> : null}
          {e.type === 'presentation' ? (
            <View style={styles.actions}>
              <Button variant="secondary" title={w.t('reportToDpa')} onPress={() => Linking.openURL(DPA_URL)} />
            </View>
          ) : null}
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  type: { fontWeight: '600', fontSize: 16 },
  actions: { marginTop: 8 },
});

import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { StoredCredential } from '../lib/types';
import { claimValue, credentialTitle } from '../lib/display';
import { useWallet } from '../state/wallet';
import { kindColors } from './theme';

export function CredentialCard({ credential, onPress }: { credential: StoredCredential; onPress: () => void }) {
  const w = useWallet();
  const given = claimValue(credential, 'given_name');
  const family = claimValue(credential, 'family_name');
  const holder = [given, family].filter(Boolean).join(' ');
  const expired = credential.expiresAt ? new Date(credential.expiresAt) < new Date() : false;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, { backgroundColor: kindColors[credential.kind], opacity: pressed ? 0.9 : 1 }]}
    >
      <View style={styles.top}>
        <Text style={styles.kind}>{credentialTitle(credential, w.t)}</Text>
        {credential.demo ? <Text style={styles.badge}>DEMO</Text> : null}
      </View>
      <Text style={styles.holder}>{holder || credential.issuer.name || credential.issuer.id}</Text>
      <Text style={styles.meta}>
        {expired
          ? w.t('expired')
          : credential.expiresAt
            ? w.t('expires', { date: new Date(credential.expiresAt).toLocaleDateString(w.locale === 'sl' ? 'sl-SI' : 'en-GB') })
            : credential.issuer.name ?? credential.issuer.id}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, padding: 18, minHeight: 130, justifyContent: 'space-between' },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  kind: { color: '#FFFFFF', fontSize: 15, fontWeight: '600', flexShrink: 1 },
  badge: { color: '#FFFFFF', fontSize: 11, fontWeight: '700', borderColor: '#FFFFFF', borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  holder: { color: '#FFFFFF', fontSize: 22, fontWeight: '700' },
  meta: { color: '#E6ECF7', fontSize: 13 },
});

import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { claimValue, credentialTitle } from '../lib/display';
import type { CredentialKind, StoredCredential } from '../lib/types';
import { useWallet } from '../state/wallet';
import { TriglavMotif } from './Motif';
import { fonts, kindColors, radius } from './theme';
import type { IconName } from './ui';

const KIND_ICON: Record<CredentialKind, IconName> = {
  pid: 'person-circle-outline',
  mdl: 'car-outline',
  diploma: 'school-outline',
  ehic: 'medkit-outline',
  other: 'document-text-outline',
};

export function CredentialCard({ credential, onPress, compact }: { credential: StoredCredential; onPress?: () => void; compact?: boolean }) {
  const w = useWallet();
  const [width, setWidth] = useState(0);
  const holder = [claimValue(credential, 'given_name'), claimValue(credential, 'family_name')].filter(Boolean).join(' ');
  const expired = credential.expiresAt ? new Date(credential.expiresAt) < new Date() : false;
  const date = credential.expiresAt
    ? new Date(credential.expiresAt).toLocaleDateString(w.locale === 'sl' ? 'sl-SI' : 'en-GB')
    : undefined;

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${credentialTitle(credential, w.t)}, ${holder}`}
      disabled={!onPress}
      onPress={onPress}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={({ pressed }) => [
        styles.card,
        compact ? styles.compact : styles.full,
        { backgroundColor: kindColors[credential.kind], transform: [{ scale: pressed ? 0.985 : 1 }] },
      ]}
    >
      {width > 0 && !compact ? (
        <View style={styles.motif}>
          <TriglavMotif width={width} height={width / 1.586 / 2.1} opacity={0.2} />
        </View>
      ) : null}
      <View style={styles.top}>
        <View style={styles.kindRow}>
          <Ionicons name={KIND_ICON[credential.kind]} size={20} color="#FFFFFF" />
          <Text style={styles.kind} numberOfLines={1}>
            {credentialTitle(credential, w.t)}
          </Text>
        </View>
        {credential.demo ? <Text style={styles.badge}>DEMO</Text> : null}
      </View>
      <View style={styles.names}>
        <Text style={styles.holder} numberOfLines={1}>
          {holder || credential.issuer.name || credential.issuer.id}
        </Text>
        <Text style={styles.meta}>
          {expired ? w.t('expired') : date ? w.t('expires', { date }) : (credential.issuer.name ?? '')}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.card, padding: 20, overflow: 'hidden', gap: 18 },
  // ID-1 card proportions (85.6 x 54 mm)
  full: { aspectRatio: 1.586 },
  compact: { minHeight: 120 },
  motif: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  kindRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  kind: { color: '#FFFFFF', fontFamily: fonts.medium, fontSize: 15, opacity: 0.92, flexShrink: 1 },
  badge: {
    color: '#FFFFFF',
    fontFamily: fonts.bold,
    fontSize: 11,
    borderColor: 'rgba(255,255,255,0.7)',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  names: { gap: 4 },
  holder: { color: '#FFFFFF', fontFamily: fonts.serif, fontSize: 26 },
  meta: { color: 'rgba(255,255,255,0.85)', fontFamily: fonts.regular, fontSize: 14 },
});

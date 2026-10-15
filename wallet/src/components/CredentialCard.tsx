import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { claimValue, credentialTitle } from '../lib/display';
import type { CredentialKind, StoredCredential } from '../lib/types';
import { useWallet } from '../state/wallet';
import { TriglavMotif } from './Motif';
import { fonts, kindGradients, radius } from './theme';
import type { IconName } from './ui';
import { useTilt } from './useTilt';

const KIND_ICON: Record<CredentialKind, IconName> = {
  pid: 'person-circle-outline',
  mdl: 'car-outline',
  diploma: 'school-outline',
  ehic: 'medkit-outline',
  other: 'document-text-outline',
};

export function CredentialCard({ credential, onPress }: { credential: StoredCredential; onPress?: () => void }) {
  const w = useWallet();
  const tilt = useTilt();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [from, to] = kindGradients[credential.kind];
  const holder = [claimValue(credential, 'given_name'), claimValue(credential, 'family_name')].filter(Boolean).join(' ');
  const expired = credential.expiresAt ? new Date(credential.expiresAt) < new Date() : false;
  const date = credential.expiresAt
    ? new Date(credential.expiresAt).toLocaleDateString(w.locale === 'sl' ? 'sl-SI' : 'en-GB')
    : undefined;
  const gid = `g-${credential.id}`;
  const sid = `s-${credential.id}`;

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${credentialTitle(credential, w.t)}, ${holder}`}
      disabled={!onPress}
      onPress={onPress}
      onLayout={(e) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
      style={({ pressed }) => [styles.card, { backgroundColor: from, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
    >
      {size.width > 0 ? (
        <>
          <Svg style={StyleSheet.absoluteFill} width={size.width} height={size.height}>
            <Defs>
              <LinearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0.25" stopColor={from} />
                <Stop offset="1" stopColor={to} />
              </LinearGradient>
            </Defs>
            <Rect width={size.width} height={size.height} fill={`url(#${gid})`} />
          </Svg>
          <View style={styles.motif}>
            <TriglavMotif width={size.width} height={size.width / 1.586 / 2.1} opacity={0.22} />
          </View>
          {/* Holographic sheen that follows the phone's tilt. */}
          <Animated.View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              {
                transform: [
                  { translateX: tilt.x.interpolate({ inputRange: [-1, 1], outputRange: [-size.width * 0.6, size.width * 0.6] }) },
                  { translateY: tilt.y.interpolate({ inputRange: [-1, 1], outputRange: [-size.height * 0.3, size.height * 0.3] }) },
                ],
              },
            ]}
          >
            <Svg width={size.width} height={size.height}>
              <Defs>
                <LinearGradient id={sid} x1="0" y1="0" x2="1" y2="0.6">
                  <Stop offset="0.35" stopColor="#FFFFFF" stopOpacity={0} />
                  <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={0.16} />
                  <Stop offset="0.65" stopColor="#FFFFFF" stopOpacity={0} />
                </LinearGradient>
              </Defs>
              <Rect width={size.width} height={size.height} fill={`url(#${sid})`} />
            </Svg>
          </Animated.View>
        </>
      ) : null}

      <View style={styles.top}>
        <View style={styles.kindChip}>
          <Ionicons name={KIND_ICON[credential.kind]} size={17} color="#FFFFFF" />
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
  // ID-1 card proportions (85.6 x 54 mm)
  card: { aspectRatio: 1.586, borderRadius: radius.card, padding: 20, overflow: 'hidden', gap: 16 },
  motif: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  kindChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  kind: { color: '#FFFFFF', fontFamily: fonts.medium, fontSize: 14, flexShrink: 1 },
  badge: {
    color: '#FFFFFF',
    fontFamily: fonts.bold,
    fontSize: 11,
    backgroundColor: 'rgba(0,0,0,0.22)',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  names: { gap: 4 },
  holder: { color: '#FFFFFF', fontFamily: fonts.display, fontSize: 26, letterSpacing: -0.3 },
  meta: { color: 'rgba(255,255,255,0.92)', fontFamily: fonts.medium, fontSize: 14 },
});

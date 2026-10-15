import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { TriglavMotif } from './Motif';
import { fonts } from './theme';
import type { IconName } from './ui';

/**
 * Coloured header that gives each screen its own identity: a gradient band with the
 * Triglav line, an icon badge, title and subtitle. Replaces the navigation bar.
 */
export function Hero({
  colors,
  icon,
  title,
  subtitle,
  back = true,
  children,
}: {
  colors: [string, string];
  icon?: IconName;
  title: string;
  subtitle?: string;
  back?: boolean;
  children?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const id = `hero-${colors.join('').replace(/#/g, '')}`;
  return (
    <View
      onLayout={(e) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
      style={[styles.wrap, { paddingTop: insets.top + 8, backgroundColor: colors[0] }]}
    >
      {size.width > 0 ? (
        <>
          <Svg style={StyleSheet.absoluteFill} width={size.width} height={size.height}>
            <Defs>
              <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0.2" stopColor={colors[0]} />
                <Stop offset="1" stopColor={colors[1]} />
              </LinearGradient>
            </Defs>
            <Rect width={size.width} height={size.height} fill={`url(#${id})`} />
          </Svg>
          <View style={styles.motif} pointerEvents="none">
            <TriglavMotif width={size.width} height={44} opacity={0.2} />
          </View>
        </>
      ) : null}
      <View style={styles.bar}>
        {back ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Nazaj / Back" onPress={() => router.back()} hitSlop={10} style={styles.back}>
            <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
          </Pressable>
        ) : (
          <View />
        )}
      </View>
      <View style={styles.body}>
        {icon ? (
          <View style={styles.badge}>
            <Ionicons name={icon} size={24} color="#FFFFFF" />
          </View>
        ) : null}
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20, paddingBottom: 52, overflow: 'hidden', borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  motif: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  bar: { height: 44, flexDirection: 'row', alignItems: 'center' },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  body: { gap: 6, marginTop: 6 },
  badge: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  title: { color: '#FFFFFF', fontFamily: fonts.display, fontSize: 28, letterSpacing: -0.4 },
  subtitle: { color: 'rgba(255,255,255,0.9)', fontFamily: fonts.regular, fontSize: 15, lineHeight: 21 },
});

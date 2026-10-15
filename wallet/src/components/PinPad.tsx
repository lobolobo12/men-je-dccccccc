import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fonts } from './theme';

export const PIN_LENGTH = 6;

type Props = { onComplete: (pin: string) => void; disabled?: boolean; color?: string; keyColor?: string };

/** Numeric PIN pad drawn for a dark/coloured background. */
export function PinPad({ onComplete, disabled, color = '#FFFFFF', keyColor = 'rgba(255,255,255,0.12)' }: Props) {
  const [pin, setPin] = useState('');

  const press = (key: string) => {
    if (disabled) return;
    Haptics.selectionAsync().catch(() => undefined);
    if (key === 'del') return setPin((p) => p.slice(0, -1));
    const next = (pin + key).slice(0, PIN_LENGTH);
    setPin(next);
    if (next.length === PIN_LENGTH) {
      setPin('');
      onComplete(next);
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.dots} accessibilityLabel={`${pin.length} / ${PIN_LENGTH}`}>
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <View key={i} style={[styles.dot, { borderColor: color, backgroundColor: i < pin.length ? color : 'transparent' }]} />
        ))}
      </View>
      <View style={styles.grid}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map((k, i) =>
          k === '' ? (
            <View key={i} style={styles.key} />
          ) : (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityLabel={k === 'del' ? 'Izbriši / Delete' : k}
              onPress={() => press(k)}
              style={({ pressed }) => [
                styles.key,
                k !== 'del' && { backgroundColor: keyColor, opacity: pressed ? 0.6 : 1, transform: [{ scale: pressed ? 0.94 : 1 }] },
              ]}
            >
              {k === 'del' ? (
                <Ionicons name="backspace-outline" size={28} color={color} />
              ) : (
                <Text style={[styles.keyText, { color }]}>{k}</Text>
              )}
            </Pressable>
          ),
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 36 },
  dots: { flexDirection: 'row', gap: 16 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2 },
  grid: { width: 282, flexDirection: 'row', flexWrap: 'wrap', columnGap: 27, rowGap: 18 },
  key: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
  keyText: { fontSize: 30, fontFamily: fonts.heading },
});

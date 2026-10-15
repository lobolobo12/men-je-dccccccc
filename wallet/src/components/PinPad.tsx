import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from './theme';

export const PIN_LENGTH = 6;

type Props = { onComplete: (pin: string) => void; disabled?: boolean };

export function PinPad({ onComplete, disabled }: Props) {
  const t = useTheme();
  const [pin, setPin] = useState('');

  const press = (key: string) => {
    if (disabled) return;
    if (key === '⌫') return setPin((p) => p.slice(0, -1));
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
          <View key={i} style={[styles.dot, { borderColor: t.primary, backgroundColor: i < pin.length ? t.primary : 'transparent' }]} />
        ))}
      </View>
      <View style={styles.grid}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((k, i) =>
          k === '' ? (
            <View key={i} style={styles.key} />
          ) : (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityLabel={k === '⌫' ? 'Delete' : k}
              onPress={() => press(k)}
              style={({ pressed }) => [styles.key, { backgroundColor: pressed ? t.border : t.surface, borderColor: t.border }]}
            >
              <Text style={[styles.keyText, { color: t.text }]}>{k}</Text>
            </Pressable>
          ),
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 28 },
  dots: { flexDirection: 'row', gap: 14 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2 },
  grid: { width: 270, flexDirection: 'row', flexWrap: 'wrap', gap: 15 },
  key: { width: 80, height: 64, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  keyText: { fontSize: 26, fontWeight: '500' },
});

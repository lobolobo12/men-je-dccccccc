import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fonts, radius, useTheme } from './theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function Screen({
  children,
  header,
  scroll = true,
  edges,
}: {
  children: ReactNode;
  /** Full-bleed coloured header (see Hero) drawn above the content. */
  header?: ReactNode;
  scroll?: boolean;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
}) {
  const t = useTheme();
  const body = <View style={styles.inner}>{children}</View>;
  const content = (
    <>
      {header}
      {body}
    </>
  );
  return (
    <SafeAreaView edges={edges ?? (header ? ['bottom', 'left', 'right'] : ['top', 'bottom', 'left', 'right'])} style={{ flex: 1, backgroundColor: t.bg }}>
      {scroll ? <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>{content}</ScrollView> : content}
    </SafeAreaView>
  );
}

export function Title({ children, size = 30 }: { children: ReactNode; size?: number }) {
  const t = useTheme();
  return <Text style={{ color: t.text, fontFamily: fonts.display, fontSize: size, lineHeight: size * 1.2, letterSpacing: -0.4 }}>{children}</Text>;
}

export function Body({ children, muted, center }: { children: ReactNode; muted?: boolean; center?: boolean }) {
  const t = useTheme();
  return (
    <Text style={[styles.body, { color: muted ? t.muted : t.text, textAlign: center ? 'center' : 'left' }]}>{children}</Text>
  );
}

/** Section heading inside a screen. */
export function Section({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Text style={[styles.section, { color: t.text }]}>{children}</Text>;
}

type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
};

export function Button({ title, onPress, variant = 'primary', icon, disabled, loading }: ButtonProps) {
  const t = useTheme();
  const filled = variant === 'primary';
  const fg = filled ? t.primaryText : variant === 'danger' ? t.danger : t.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: filled ? t.primary : variant === 'ghost' ? 'transparent' : t.surface,
          borderColor: filled || variant === 'ghost' ? 'transparent' : t.border,
          opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.985 : 1 }],
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.buttonRow}>
          {icon ? <Ionicons name={icon} size={20} color={fg} /> : null}
          <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function Card({ children, padded = true }: { children: ReactNode; padded?: boolean }) {
  const t = useTheme();
  return <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border, padding: padded ? 16 : 0 }]}>{children}</View>;
}

/** Label/value pair for credential attributes. */
export function Field({ label, value, last }: { label: string; value: string; last?: boolean }) {
  const t = useTheme();
  return (
    <View style={[styles.field, { borderBottomColor: t.border, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth }]}>
      <Text style={[styles.fieldLabel, { color: t.muted }]}>{label}</Text>
      <Text selectable style={[styles.fieldValue, { color: t.text }]}>
        {value}
      </Text>
    </View>
  );
}

/** Tappable row in a grouped list, iOS settings style. */
export function ListRow({
  icon,
  title,
  subtitle,
  onPress,
  tint,
  right,
  last,
}: {
  icon?: IconName;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  tint?: string;
  right?: ReactNode;
  last?: boolean;
}) {
  const t = useTheme();
  const color = tint ?? t.primary;
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.listRow, { backgroundColor: pressed ? t.sunken : 'transparent' }]}
    >
      {icon ? (
        <View style={[styles.listIcon, { backgroundColor: tint === t.danger ? t.warnBg : t.blueTint }]}>
          <Ionicons name={icon} size={19} color={color} />
        </View>
      ) : null}
      <View style={[styles.listBody, { borderBottomColor: t.border, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.listTitle, { color: tint === t.danger ? t.danger : t.text }]}>{title}</Text>
          {subtitle ? <Text style={[styles.listSub, { color: t.muted }]}>{subtitle}</Text> : null}
        </View>
        {right ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={t.muted} /> : null)}
      </View>
    </Pressable>
  );
}

export function Notice({ text, tone = 'warn', icon }: { text: string; tone?: 'warn' | 'ok' | 'info'; icon?: IconName }) {
  const t = useTheme();
  const bg = tone === 'warn' ? t.warnBg : tone === 'ok' ? t.okBg : t.sunken;
  const fg = tone === 'warn' ? t.warnText : tone === 'ok' ? t.okText : t.muted;
  const name: IconName = icon ?? (tone === 'warn' ? 'alert-circle' : tone === 'ok' ? 'shield-checkmark' : 'information-circle');
  return (
    <View style={[styles.notice, { backgroundColor: bg }]}>
      <Ionicons name={name} size={20} color={fg} style={{ marginTop: 1 }} />
      <Text style={[styles.noticeText, { color: fg }]}>{text}</Text>
    </View>
  );
}

export function Input(props: TextInputProps) {
  const t = useTheme();
  return (
    <TextInput
      placeholderTextColor={t.muted}
      {...props}
      style={[styles.input, { color: t.text, borderColor: t.border, backgroundColor: t.surface }, props.style]}
    />
  );
}

export function IconButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.iconButton, { backgroundColor: pressed ? t.border : t.surface, borderColor: t.border }]}
    >
      <Ionicons name={icon} size={22} color={t.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  inner: { padding: 20, gap: 14 },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 24 },
  section: { fontFamily: fonts.heading, fontSize: 17, marginTop: 10, marginBottom: -2 },
  button: { minHeight: 54, borderRadius: radius.control, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  buttonRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  buttonText: { fontFamily: fonts.bold, fontSize: 16 },
  card: { borderRadius: radius.tile, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  field: { paddingVertical: 11, gap: 3 },
  fieldLabel: { fontFamily: fonts.regular, fontSize: 13 },
  fieldValue: { fontFamily: fonts.medium, fontSize: 17 },
  listRow: { flexDirection: 'row', alignItems: 'center', paddingLeft: 14, gap: 12 },
  listIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  listBody: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingRight: 14, gap: 8 },
  listTitle: { fontFamily: fonts.medium, fontSize: 16 },
  listSub: { fontFamily: fonts.regular, fontSize: 13, marginTop: 2 },
  notice: { flexDirection: 'row', gap: 10, borderRadius: radius.small, padding: 14 },
  noticeText: { flex: 1, fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 },
  input: { borderWidth: 1, borderRadius: radius.small, padding: 14, fontSize: 16, fontFamily: fonts.regular },
  iconButton: { width: 44, height: 44, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
});

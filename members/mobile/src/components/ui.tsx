import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native';
import { C, F } from '../lib/theme';

export const Eyebrow = ({ children, style }: { children: ReactNode; style?: TextStyle }) => <Text style={[s.eyebrow, style]}>{children}</Text>;
export const Title = ({ children }: { children: ReactNode }) => <Text style={s.title}>{children}</Text>;
export const H2 = ({ children }: { children: ReactNode }) => <Text style={s.h2}>{children}</Text>;
export const P = ({ children, style }: { children: ReactNode; style?: TextStyle }) => <Text style={[s.p, style]}>{children}</Text>;
export const Card = ({ children, style }: { children: ReactNode; style?: ViewStyle }) => <View style={[s.card, style]}>{children}</View>;
export const Rule = () => <View style={s.rule} />;

export function Button({ label, onPress, ghost, busy, disabled }: { label: string; onPress: () => void; ghost?: boolean; busy?: boolean; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} disabled={busy || disabled}
      style={({ pressed }) => [s.btn, ghost && s.ghost, (pressed || disabled) && { opacity: 0.7 }]}>
      {busy ? <ActivityIndicator color={ghost ? C.soft : '#15190f'} /> : <Text style={[s.btnText, ghost && { color: C.soft }]}>{label}</Text>}
    </Pressable>
  );
}

export const Loading = () => <View style={s.center}><ActivityIndicator color={C.gold} /></View>;

const s = StyleSheet.create({
  eyebrow: { fontFamily: F.bold, fontSize: 12, letterSpacing: 2.2, textTransform: 'uppercase', color: C.gold, marginBottom: 10 },
  title: { fontFamily: F.display, fontSize: 56, lineHeight: 54, color: C.ink, marginBottom: 16 },
  h2: { fontFamily: F.display, fontSize: 36, lineHeight: 36, color: C.gold, marginBottom: 10 },
  p: { fontFamily: F.body, fontSize: 17, lineHeight: 26, color: C.soft, marginBottom: 12 },
  card: { backgroundColor: C.bg2, borderColor: C.border, borderWidth: 1, borderRadius: 12, padding: 20 },
  rule: { height: 1, backgroundColor: C.line, marginVertical: 24 },
  btn: { backgroundColor: C.gold, borderRadius: 8, paddingVertical: 15, paddingHorizontal: 24, alignItems: 'center', alignSelf: 'flex-start', minWidth: 120 },
  ghost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.line },
  btnText: { fontFamily: F.bold, fontSize: 16, color: '#15190f' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
});

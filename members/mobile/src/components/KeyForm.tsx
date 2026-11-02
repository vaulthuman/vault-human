// One Key's own boxes (the same ones as the members site), saved through /api/app/answers. Any open Key, any order.
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ApiError, saveAnswers, type KeyWithAnswers, type Status, type Today } from '../lib/api';
import { C, F } from '../lib/theme';
import { Button, Card, P } from './ui';

export const STATUS_WORD: Record<Status, string> = { done: 'Done', started: 'Started', open: 'To do' };
const deviceTz = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return ''; } };

export function StatusPill({ status }: { status: Status }) {
  const color = status === 'done' ? C.green : status === 'started' ? C.gold : C.mute;
  return <Text style={[s.pill, { color, borderColor: color }]}>{STATUS_WORD[status]}</Text>;
}

export function KeyForm({ k, onSaved }: { k: KeyWithAnswers; onSaved?: (today: Today) => void }) {
  const [values, setValues] = useState<Record<string, string>>(k.answers ?? {});
  const [status, setStatus] = useState<Status>(k.status);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { setValues(k.answers ?? {}); setStatus(k.status); setMsg(''); }, [k.id, k.answers, k.status]);

  const set = (id: string, v: string) => { setValues((x) => ({ ...x, [id]: v })); setMsg(''); };
  const save = async () => {
    setBusy(true); setError('');
    try {
      const r = await saveAnswers(k.id, values, deviceTz());
      const filled = k.prompts.filter((p) => (values[p.id] ?? '').trim()).length;
      setStatus(filled === k.prompts.length ? 'done' : filled ? 'started' : 'open');
      setMsg('Saved. You can come back and add to it any time.');
      onSaved?.(r.today);
    } catch (e) { setError((e as ApiError).message); }
    finally { setBusy(false); }
  };

  if (!k.prompts.length) return null;
  return (
    <Card style={{ marginTop: 22 }}>
      <View style={s.head}>
        <Text style={s.label}>Your notes on {k.id}</Text>
        <StatusPill status={status} />
      </View>
      {k.prompts.map((p) => (
        <View key={p.id} style={{ marginBottom: 18 }}>
          {p.kind === 'check' ? (
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: values[p.id] === 'yes' }}
              onPress={() => set(p.id, values[p.id] === 'yes' ? '' : 'yes')} style={s.checkRow}>
              <View style={[s.box, values[p.id] === 'yes' && s.boxOn]}>{values[p.id] === 'yes' ? <Text style={s.tick}>✓</Text> : null}</View>
              <Text style={s.q}>{p.label}</Text>
            </Pressable>
          ) : (
            <>
              <Text style={s.q}>{p.label}</Text>
              {p.kind === 'scale' ? (
                <View style={s.scale}>
                  {Array.from({ length: 10 }, (_, i) => String(i + 1)).map((n) => (
                    <Pressable key={n} accessibilityRole="radio" accessibilityState={{ selected: values[p.id] === n }}
                      onPress={() => set(p.id, values[p.id] === n ? '' : n)} style={[s.dot, values[p.id] === n && s.dotOn]}>
                      <Text style={[s.dotText, values[p.id] === n && { color: '#15190f' }]}>{n}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : (
                <TextInput style={[s.input, p.kind === 'long' && { minHeight: 110, textAlignVertical: 'top' }]} value={values[p.id] ?? ''}
                  onChangeText={(v) => set(p.id, v)} multiline={p.kind === 'long'} maxLength={p.kind === 'long' ? 1200 : 280}
                  placeholder={p.kind === 'long' ? 'A few lines is plenty.' : 'One line is enough.'} placeholderTextColor={C.mute} />
              )}
            </>
          )}
        </View>
      ))}
      <View style={s.row}>
        <Button label="Save" onPress={save} busy={busy} />
        {msg ? <Text style={s.saved}>{msg}</Text> : null}
      </View>
      {k.lines?.length ? (
        <View style={{ marginTop: 16 }}>
          <Text style={s.earlier}>Earlier note</Text>
          {k.lines.map((l) => <P key={l.day} style={{ marginBottom: 4, fontSize: 15 }}>{l.line}</P>)}
        </View>
      ) : null}
      {error ? <P style={{ color: C.error, marginTop: 10, marginBottom: 0 }}>{error}</P> : null}
    </Card>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 16 },
  label: { fontFamily: F.bold, fontSize: 12, letterSpacing: 2.2, textTransform: 'uppercase', color: C.gold, flexShrink: 1 },
  pill: { fontFamily: F.semi, fontSize: 12, borderWidth: 1, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10, overflow: 'hidden' },
  q: { fontFamily: F.medium, fontSize: 16, lineHeight: 23, color: C.ink, marginBottom: 10, flexShrink: 1 },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  box: { width: 26, height: 26, borderRadius: 6, borderWidth: 1.5, borderColor: '#3a4a41', alignItems: 'center', justifyContent: 'center', marginTop: -1 },
  boxOn: { backgroundColor: C.green, borderColor: C.green },
  tick: { color: '#15190f', fontFamily: F.bold, fontSize: 16 },
  scale: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  dot: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: '#3a4a41', alignItems: 'center', justifyContent: 'center' },
  dotOn: { backgroundColor: C.gold, borderColor: C.gold },
  dotText: { fontFamily: F.semi, fontSize: 15, color: C.soft },
  input: { backgroundColor: '#0f1411', color: C.ink, borderColor: '#3a4a41', borderWidth: 1, borderRadius: 8, padding: 14, fontFamily: F.body, fontSize: 17 },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 14 },
  saved: { fontFamily: F.body, fontSize: 14, color: C.green, flexShrink: 1 },
  earlier: { fontFamily: F.bold, fontSize: 11, letterSpacing: 1.8, textTransform: 'uppercase', color: C.mute, marginBottom: 6 },
});

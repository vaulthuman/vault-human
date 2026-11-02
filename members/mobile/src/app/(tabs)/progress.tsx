// Progress: what's done, what's still to do (tap to finish, in any order), and the streak. Same as the members site.
import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Eyebrow, Loading, P, Title } from '../../components/ui';
import { ApiError, fetchKeys } from '../../lib/api';
import { C, F } from '../../lib/theme';

type Data = Awaited<ReturnType<typeof fetchKeys>>;
const SEG = { done: C.green, started: C.gold, open: '#3a4a41', locked: 'rgba(241,237,228,0.08)' };

export default function ProgressScreen() {
  const [d, setD] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try { setD(await fetchKeys()); setError(''); } catch (e) { setError((e as ApiError).message); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  if (!d) return error ? <SafeAreaView style={s.screen}><P style={{ padding: 20 }}>{error}</P></SafeAreaView> : <Loading />;

  const opened = [...d.keys].reverse(); // oldest first
  const done = opened.filter((k) => k.status === 'done');
  const todo = opened.filter((k) => k.status !== 'done');
  const locked = Math.max(d.total - opened.length, 0);

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48 }} refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={C.gold} />}>
        <Eyebrow>Progress</Eyebrow>
        <Title>Where you are.</Title>

        <Card>
          <Text style={s.k}>Your Keys</Text>
          <Text style={s.big}><Text style={s.num}>{done.length}</Text> of {opened.length} done</Text>
          <View style={s.bar}>
            {opened.map((k) => <View key={k.id} style={[s.seg, { backgroundColor: SEG[k.status] }]} />)}
            {Array.from({ length: locked }, (_, i) => <View key={`l${i}`} style={[s.seg, { backgroundColor: SEG.locked }]} />)}
          </View>
          <View style={s.legend}>
            {([['done', 'Done'], ['started', 'Started'], ['open', 'To do'], ['locked', 'Not open yet']] as const).map(([c, w]) => (
              <View key={c} style={s.legendItem}><View style={[s.sw, { backgroundColor: SEG[c] }]} /><Text style={s.legendText}>{w}</Text></View>
            ))}
          </View>

          {todo.length ? (
            <>
              <Text style={s.sub}>Still to do</Text>
              {todo.map((k) => (
                <Link key={k.id} href={{ pathname: '/key/[id]', params: { id: k.id } }} asChild>
                  <Pressable style={s.item}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.small}>{k.id} · {k.time === 'morning' ? 'Morning Key' : 'Evening Key'}</Text>
                      <Text style={s.title}>{k.title}</Text>
                    </View>
                    <Text style={[s.action, { color: k.status === 'started' ? C.gold : C.ink }]}>{k.status === 'started' ? 'Finish' : 'Start'} →</Text>
                  </Pressable>
                </Link>
              ))}
            </>
          ) : <P style={{ marginTop: 14, marginBottom: 0 }}>Every open Key is done. Nicely kept.</P>}
          {d.next ? <P style={{ marginTop: 14, marginBottom: 0, color: C.mute, fontSize: 15 }}>Next: {d.next.title} opens {d.next.when}.</P> : null}
          {done.length ? (
            <>
              <Text style={s.sub}>Done ({done.length})</Text>
              {done.map((k) => (
                <Link key={k.id} href={{ pathname: '/key/[id]', params: { id: k.id } }} asChild>
                  <Pressable style={s.item}>
                    <View style={{ flex: 1 }}><Text style={s.small}>{k.id}</Text><Text style={s.title}>{k.title}</Text></View>
                    <Text style={[s.action, { color: C.green }]}>Done</Text>
                  </Pressable>
                </Link>
              ))}
            </>
          ) : null}
        </Card>

        <Card style={{ marginTop: 18 }}>
          <Text style={s.k}>Streak</Text>
          <Text style={s.big}><Text style={s.num}>{d.streak}</Text> {d.streak === 1 ? 'day' : 'days'} in a row</Text>
          <P style={{ marginBottom: 0 }}>A day counts when you fill in any Key, old or new. Miss one day in a week and the streak keeps going.</P>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  k: { fontFamily: F.bold, fontSize: 12, letterSpacing: 2.2, textTransform: 'uppercase', color: C.gold, marginBottom: 10 },
  big: { fontFamily: F.semi, fontSize: 20, color: C.ink, marginBottom: 14 },
  num: { fontFamily: F.display, fontSize: 44, color: C.ink },
  bar: { flexDirection: 'row', gap: 3, height: 14, marginBottom: 12 },
  seg: { flex: 1, borderRadius: 3 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginBottom: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sw: { width: 12, height: 12, borderRadius: 3 },
  legendText: { fontFamily: F.body, fontSize: 13, color: C.soft },
  sub: { fontFamily: F.bold, fontSize: 11, letterSpacing: 1.8, textTransform: 'uppercase', color: C.mute, marginTop: 22, marginBottom: 8 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: C.line },
  small: { fontFamily: F.bold, fontSize: 11, letterSpacing: 1.6, color: C.gold, marginBottom: 2 },
  title: { fontFamily: F.display, fontSize: 24, color: C.ink },
  action: { fontFamily: F.semi, fontSize: 15 },
});

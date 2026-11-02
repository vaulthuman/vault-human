// My keys: every Key opened so far, newest first, with the member's own lines.
import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Eyebrow, Loading, P, Title } from '../../components/ui';
import { ApiError, fetchKeys, type KeyWithLines } from '../../lib/api';
import { C, F } from '../../lib/theme';

export default function KeysScreen() {
  const [keys, setKeys] = useState<KeyWithLines[] | null>(null);
  const [current, setCurrent] = useState('');
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try { const r = await fetchKeys(); setKeys(r.keys); setCurrent(r.current); setError(''); }
    catch (e) { setError((e as ApiError).message); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  if (!keys) return error ? <SafeAreaView style={s.screen}><P style={{ padding: 20 }}>{error}</P></SafeAreaView> : <Loading />;
  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <FlatList
        data={keys}
        keyExtractor={(k) => k.id}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={C.gold} />}
        ListHeaderComponent={<View><Eyebrow>My keys</Eyebrow><Title>Keys received.</Title><P>{keys.length} so far, newest first.</P></View>}
        renderItem={({ item: k }) => (
          <Link href={{ pathname: '/key/[id]', params: { id: k.id } }} asChild>
            <Pressable style={s.item}>
              <Image source={{ uri: k.poster }} style={s.img} />
              <View style={{ flex: 1, paddingVertical: 12, paddingRight: 14 }}>
                <Text style={s.id}>{k.id}{k.id === current ? ' · Current' : ''}</Text>
                <Text style={s.title}>{k.title}</Text>
                <Text style={[s.line, !k.lines.length && { color: C.mute }]} numberOfLines={1}>{k.lines[0]?.line ?? 'Not logged yet'}</Text>
              </View>
            </Pressable>
          </Link>
        )}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  item: { flexDirection: 'row', gap: 14, alignItems: 'center', backgroundColor: C.bg2, borderColor: C.border, borderWidth: 1, borderRadius: 12, overflow: 'hidden', marginBottom: 12 },
  img: { width: 112, alignSelf: 'stretch', minHeight: 84, backgroundColor: '#000' },
  id: { fontFamily: F.bold, fontSize: 11, letterSpacing: 1.8, color: C.gold, marginBottom: 3 },
  title: { fontFamily: F.display, fontSize: 26, color: C.ink },
  line: { fontFamily: F.body, fontSize: 14, color: C.soft, marginTop: 2 },
});

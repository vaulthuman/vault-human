// One Key the member has already received, with its own boxes: fill it in or finish it any time, in any order.
import { Link, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { KeyForm } from '../../components/KeyForm';
import { KeyView } from '../../components/KeyView';
import { Loading, P } from '../../components/ui';
import { ApiError, fetchKeys, type KeyWithLines } from '../../lib/api';
import { C, F } from '../../lib/theme';

export default function KeyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [keys, setKeys] = useState<KeyWithLines[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    fetchKeys().then((r) => setKeys(r.keys)).catch((e) => setError((e as ApiError).message));
  }, [id]);
  if (!keys) return error ? <P style={{ padding: 20 }}>{error}</P> : <Loading />;
  const i = keys.findIndex((x) => x.id.toLowerCase() === String(id).toLowerCase());
  if (i < 0) return <P style={{ padding: 20 }}>This Key isn’t open yet.</P>;
  const k = keys[i];
  const newer = keys[i - 1];
  const older = keys[i + 1];
  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 20, paddingBottom: 48 }}>
      <KeyView k={k} />
      <KeyForm k={k} onSaved={() => fetchKeys().then((r) => setKeys(r.keys)).catch(() => {})} />
      <View style={s.pager}>
        {older ? <Link href={{ pathname: '/key/[id]', params: { id: older.id } }} asChild><Pressable><Text style={s.link}>← {older.id}</Text></Pressable></Link> : <View />}
        {newer ? <Link href={{ pathname: '/key/[id]', params: { id: newer.id } }} asChild><Pressable><Text style={s.link}>{newer.id} →</Text></Pressable></Link> : <View />}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  pager: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 24 },
  link: { fontFamily: F.semi, fontSize: 16, color: C.gold, paddingVertical: 8 },
});

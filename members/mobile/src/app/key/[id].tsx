// One Key the member has already received, with their lines for it.
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { KeyView } from '../../components/KeyView';
import { Card, Eyebrow, Loading, P } from '../../components/ui';
import { ApiError, fetchKeys, type KeyWithLines } from '../../lib/api';
import { C, F } from '../../lib/theme';

export default function KeyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [k, setK] = useState<KeyWithLines | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    fetchKeys().then((r) => {
      const found = r.keys.find((x) => x.id.toLowerCase() === String(id).toLowerCase());
      found ? setK(found) : setError('This Key isn’t open yet.');
    }).catch((e) => setError((e as ApiError).message));
  }, [id]);
  if (!k) return error ? <P style={{ padding: 20 }}>{error}</P> : <Loading />;
  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 20, paddingBottom: 48 }}>
      <KeyView k={k} />
      <Card style={{ marginTop: 22 }}>
        <Eyebrow>What I did, and what it did.</Eyebrow>
        {k.lines.length ? k.lines.map((l) => <Text key={l.day} style={{ fontFamily: F.body, fontSize: 17, color: C.ink, marginBottom: 6 }}>{l.line}</Text>)
          : <P style={{ marginBottom: 0 }}>Nothing logged for this Key.</P>}
      </Card>
    </ScrollView>
  );
}

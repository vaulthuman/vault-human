// Today: the current Key and its own boxes, what else is open, when the next Key opens, and the first session.
import { useFocusEffect, Link } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useState } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyForm, StatusPill } from '../../components/KeyForm';
import { KeyView } from '../../components/KeyView';
import { Button, Card, Eyebrow, Loading, P, Rule } from '../../components/ui';
import { ApiError, fetchToday, type Member, type Today } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { remindersAllowed, turnOnReminders } from '../../lib/push';
import { C, F } from '../../lib/theme';

const daysInARow = (n: number) => `${n} ${n === 1 ? 'day' : 'days'} in a row`;

export default function TodayScreen() {
  const { signOut } = useAuth();
  const [data, setData] = useState<{ member: Member; today: Today | null } | null>(null);
  const [error, setError] = useState('');
  const [reminders, setReminders] = useState<'unknown' | 'on' | 'off' | 'denied' | 'unavailable'>('unknown');

  const load = useCallback(async () => {
    setError('');
    try {
      const d = await fetchToday();
      setData(d);
    } catch (e) {
      if ((e as ApiError).status === 401) return signOut();
      setError((e as ApiError).message);
    }
    setReminders((await remindersAllowed()) ? 'on' : 'off');
  }, [signOut]);
  useFocusEffect(useCallback(() => { load(); }, [load]));


  if (!data) return error ? <SafeAreaView style={s.screen}><View style={s.wrap}><P>{error}</P><Button label="Try again" onPress={load} /></View></SafeAreaView> : <Loading />;
  const t = data.today;

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <ScrollView contentContainerStyle={s.wrap} refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={C.gold} />}>
        <Text style={s.brand}>Vault <Text style={{ color: C.green }}>Human</Text></Text>
        {!t ? (
          <View style={{ marginTop: 30 }}>
            <Eyebrow>Membership</Eyebrow>
            <P style={{ color: C.ink }}>Your membership isn’t open right now. When it is, your Keys will be waiting here.</P>
            <P>Questions? Write to vault@vaulthuman.com.</P>
          </View>
        ) : (
          <>
            <Text style={s.greet}>{t.greeting}</Text>
            <View style={s.chips}>
              <Text style={s.chip}>{t.chamber.n ? `Chamber ${t.chamber.n} · ${t.chamber.name}` : t.chamber.name}</Text>
              <Text style={s.chip}>Key {t.keyNumber} · {t.key.id}</Text>
            </View>
            <KeyView k={t.key} />
            <Rule />
            <KeyForm k={t.key} onSaved={(today) => setData((d) => (d ? { ...d, today } : d))} />
            <P style={{ marginTop: 14, color: C.mute, fontSize: 15 }}>
              {t.streak ? `Streak: ${daysInARow(t.streak)}. ` : ''}Any Key you’ve opened can be filled in later, in any order.
            </P>
            {t.also.length > 0 && (
              <View style={{ marginTop: 24 }}>
                <Eyebrow>Also open now</Eyebrow>
                {t.also.map((k) => (
                  <Link key={k.id} href={{ pathname: '/key/[id]', params: { id: k.id } }} asChild>
                    <Pressable style={s.also}>
                      <Image source={{ uri: k.poster }} style={s.alsoImg} />
                      <View style={{ flex: 1, paddingVertical: 10 }}>
                        <Text style={s.alsoId}>{k.id}</Text>
                        <Text style={s.alsoTitle}>{k.title}</Text>
                      </View>
                      <View style={{ paddingRight: 12 }}><StatusPill status={k.status} /></View>
                    </Pressable>
                  </Link>
                ))}
              </View>
            )}
            {t.next ? <P style={{ marginTop: 18, color: C.mute, fontSize: 15 }}>Your next Key, {t.next.title}, opens {t.next.when}.</P> : null}
            {t.firstWeek && (
              <Card style={{ marginTop: 18 }}>
                <Eyebrow>Your first session with Russ</Eyebrow>
                <P>{t.firstWeek.lastDay
                  ? 'Your first seven days of Keys end today. Bring what they showed you to your session with Russ.'
                  : 'Your membership includes a one-on-one session with Russ to look at what the Keys are showing you.'}</P>
                <Button label="Pick a time" onPress={() => WebBrowser.openBrowserAsync(t.firstWeek!.bookingUrl)} />
              </Card>
            )}
            <Rule />
            <Eyebrow>Reminders</Eyebrow>
            <P>A nudge when your Key opens and one before bed.</P>
            {reminders === 'on' ? <P style={{ color: C.mute, fontSize: 15 }}>Reminders are on for this phone.</P>
              : reminders === 'denied' ? <P style={{ color: C.mute, fontSize: 15 }}>Reminders are off in this phone’s settings.</P>
              : reminders === 'unavailable' ? <P style={{ color: C.mute, fontSize: 15 }}>Reminders aren’t available on this device.</P>
              : <Button ghost label="Turn on reminders" onPress={async () => setReminders(await turnOnReminders())} />}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  wrap: { padding: 20, paddingBottom: 48 },
  brand: { fontFamily: F.display, fontSize: 30, letterSpacing: 2, color: C.ink, textTransform: 'uppercase', marginBottom: 18 },
  greet: { fontFamily: F.semi, fontSize: 20, color: C.ink, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 22 },
  chip: { fontFamily: F.semi, fontSize: 13, color: C.green, borderWidth: 1, borderColor: 'rgba(143,166,126,.45)', borderRadius: 999, paddingVertical: 7, paddingHorizontal: 12, overflow: 'hidden' },
  label: { fontFamily: F.bold, fontSize: 12, letterSpacing: 2.2, textTransform: 'uppercase', color: C.gold, marginBottom: 12 },
  input: { backgroundColor: '#0f1411', color: C.ink, borderColor: '#3a4a41', borderWidth: 1, borderRadius: 8, padding: 14, fontFamily: F.body, fontSize: 17, marginBottom: 14 },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 14 },
  done: { fontFamily: F.body, fontSize: 15, color: C.soft },
  also: { flexDirection: 'row', gap: 14, alignItems: 'center', backgroundColor: C.bg2, borderColor: C.border, borderWidth: 1, borderRadius: 12, overflow: 'hidden', marginBottom: 10 },
  alsoImg: { width: 112, height: 63, backgroundColor: '#000' },
  alsoId: { fontFamily: F.bold, fontSize: 11, letterSpacing: 1.8, color: C.gold, marginBottom: 3 },
  alsoTitle: { fontFamily: F.display, fontSize: 26, color: C.ink },
});

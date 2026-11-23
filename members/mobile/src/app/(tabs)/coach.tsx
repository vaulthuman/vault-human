// Russ: the first session, how to reach him, membership, and signing out.
import * as WebBrowser from 'expo-web-browser';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, Eyebrow, P, Rule, Title } from '../../components/ui';
import { fetchToday, type Member, type Today } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { C, F } from '../../lib/theme';

const BOOKING_FALLBACK = 'https://calendly.com/vaulthuman/free-call';

export default function CoachScreen() {
  const { signOut } = useAuth();
  const [member, setMember] = useState<Member | null>(null);
  const [today, setToday] = useState<Today | null>(null);
  useFocusEffect(useCallback(() => { fetchToday().then((d) => { setMember(d.member); setToday(d.today); }).catch(() => {}); }, []));
  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48 }}>
        <Eyebrow>Your coach</Eyebrow>
        <Title>Russ.</Title>
        <Card>
          <Eyebrow>One-on-one</Eyebrow>
          <P>Book a session to look at what the Keys are showing you.</P>
          <Button label="Pick a time" onPress={() => WebBrowser.openBrowserAsync(today?.firstWeek?.bookingUrl ?? BOOKING_FALLBACK)} />
        </Card>
        <Card style={{ marginTop: 14 }}>
          <Eyebrow>Reach him</Eyebrow>
          <Text style={s.link} onPress={() => Linking.openURL('mailto:vault@vaulthuman.com')}>vault@vaulthuman.com</Text>
          <Text style={s.link} onPress={() => Linking.openURL('tel:+18888332510')}>(888) 833-2510</Text>
        </Card>
        <Rule />
        <Eyebrow>Membership</Eyebrow>
        {member ? <P>Signed in as {member.email}.</P> : null}
        <Text style={s.link} onPress={() => WebBrowser.openBrowserAsync('https://members.vaulthuman.com/membership')}>Manage membership</Text>
        <Text style={s.link} onPress={() => WebBrowser.openBrowserAsync('https://www.vaulthuman.com/privacy/')}>Privacy</Text>
        <P style={{ marginTop: 16, color: C.mute, fontSize: 14 }}>Coaching, not therapy.</P>
        <Button ghost label="Sign out" onPress={signOut} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  link: { fontFamily: F.semi, fontSize: 17, color: C.gold, marginBottom: 12 },
});

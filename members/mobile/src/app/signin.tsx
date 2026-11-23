// Sign in with an emailed six-digit code: the same email as the membership.
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, Eyebrow, P, Title } from '../components/ui';
import { ApiError, requestCode, verifyCode } from '../lib/api';
import { useAuth } from '../lib/auth';
import { C, F } from '../lib/theme';

export default function SignIn() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const send = async () => {
    setError(''); setBusy(true);
    try { setChallenge((await requestCode(email.trim())).challenge); setCode(''); }
    catch (e) { setError((e as ApiError).message); }
    finally { setBusy(false); }
  };
  const verify = async () => {
    setError(''); setBusy(true);
    try {
      const r = await verifyCode(email.trim(), code.trim(), challenge!);
      await signIn(r.token);
      router.replace('/');
    } catch (e) { setError((e as ApiError).message); }
    finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
          <Text style={s.brand}>Vault <Text style={{ color: C.green }}>Human</Text></Text>
          <Text style={s.small}>Members</Text>
          <Eyebrow style={{ marginTop: 36 }}>Members</Eyebrow>
          <Title>Sign in.</Title>
          {!challenge ? (
            <Card>
              <Text style={s.label}>Your membership email</Text>
              <TextInput style={s.input} value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor={C.mute}
                autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" returnKeyType="send" onSubmitEditing={send} />
              <Button label="Email me a code" onPress={send} busy={busy} disabled={!email.includes('@')} />
            </Card>
          ) : (
            <Card>
              <P style={{ color: C.ink }}>If that address belongs to a member, a six-digit code is on its way. It works once, for 10 minutes.</P>
              <Text style={s.label}>Code</Text>
              <TextInput style={[s.input, s.code]} value={code} onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))} placeholder="000000" placeholderTextColor={C.mute}
                keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="one-time-code" maxLength={6} returnKeyType="done" onSubmitEditing={verify} />
              <Button label="Sign in" onPress={verify} busy={busy} disabled={code.length !== 6} />
              <Text style={s.link} onPress={() => { setChallenge(null); setError(''); }}>Use a different email</Text>
            </Card>
          )}
          {error ? <P style={{ color: C.error, marginTop: 14 }}>{error}</P> : null}
          <P style={{ marginTop: 28, fontSize: 14, color: C.mute }}>Coaching, not therapy.</P>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  wrap: { padding: 20, paddingBottom: 40 },
  brand: { fontFamily: F.display, fontSize: 34, letterSpacing: 2, color: C.ink, textTransform: 'uppercase' },
  small: { fontFamily: F.semi, fontSize: 12, letterSpacing: 1.7, textTransform: 'uppercase', color: C.gold, marginTop: 2 },
  label: { fontFamily: F.bold, fontSize: 12, letterSpacing: 2.2, textTransform: 'uppercase', color: C.gold, marginBottom: 12 },
  input: { backgroundColor: '#0f1411', color: C.ink, borderColor: '#3a4a41', borderWidth: 1, borderRadius: 8, padding: 14, fontFamily: F.body, fontSize: 17, marginBottom: 16 },
  code: { fontSize: 28, letterSpacing: 8, fontFamily: F.bold },
  link: { fontFamily: F.medium, fontSize: 15, color: C.gold, marginTop: 16 },
});

import { BebasNeue_400Regular } from '@expo-google-fonts/bebas-neue';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { AuthProvider, useAuth } from '../lib/auth';
import { C, F } from '../lib/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

/** A tapped reminder opens Today. Phones only: the web preview has no notifications. */
function NotificationTaps() {
  const tapped = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (tapped && tapped.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) router.navigate('/');
  }, [tapped]);
  return null;
}

function Root() {
  const { ready } = useAuth();
  const [fonts] = useFonts({ BebasNeue_400Regular, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });

  useEffect(() => { if (ready && fonts) SplashScreen.hideAsync().catch(() => {}); }, [ready, fonts]);
  if (!ready || !fonts) return null;
  return (
    <>
      <StatusBar style="light" />
      {Platform.OS !== 'web' && <NotificationTaps />}
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="signin" />
        <Stack.Screen name="key/[id]" options={{ headerShown: true, title: '', headerStyle: { backgroundColor: C.bg }, headerTintColor: C.gold,
          headerTitleStyle: { fontFamily: F.semi }, headerBackTitle: 'My keys' }} />
      </Stack>
    </>
  );
}

export default function Layout() {
  return <AuthProvider><Root /></AuthProvider>;
}

import { Redirect, Tabs } from 'expo-router';
import { useAuth } from '../../lib/auth';
import '../../lib/push';
import { C, F } from '../../lib/theme';

export default function TabLayout() {
  const { signedIn } = useAuth();
  if (!signedIn) return <Redirect href="/signin" />;
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: C.ink,
      tabBarInactiveTintColor: C.mute,
      tabBarStyle: { backgroundColor: C.bg, borderTopColor: C.line },
      tabBarLabelStyle: { fontFamily: F.semi, fontSize: 13, marginBottom: 4 },
      tabBarIconStyle: { display: 'none' },
      sceneStyle: { backgroundColor: C.bg },
    }}>
      <Tabs.Screen name="index" options={{ title: 'Today' }} />
      <Tabs.Screen name="keys" options={{ title: 'My keys' }} />
      <Tabs.Screen name="progress" options={{ title: 'Progress' }} />
      <Tabs.Screen name="coach" options={{ title: 'Russ' }} />
    </Tabs>
  );
}

// Reminders on the phone: 8 a.m. and 8 p.m. in the member's time zone, sent by the members site's hourly clock.
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { savePushToken } from './api';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldPlaySound: false, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
  });
}

/** Asks for permission (once) and registers this phone. Returns a short status for the screen. */
export async function turnOnReminders(): Promise<'on' | 'denied' | 'unavailable'> {
  if (Platform.OS === 'web' || !Device.isDevice) return 'unavailable';
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('reminders', { name: 'Reminders', importance: Notifications.AndroidImportance.DEFAULT });
  }
  const existing = await Notifications.getPermissionsAsync();
  let granted = existing.granted;
  if (!granted && existing.canAskAgain) granted = (await Notifications.requestPermissionsAsync()).granted;
  if (!granted) return 'denied';
  const projectId = (Constants.expoConfig?.extra as any)?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return 'unavailable';
  try {
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    await savePushToken(token);
    return 'on';
  } catch {
    return 'unavailable';
  }
}

export async function remindersAllowed() {
  if (Platform.OS === 'web') return false;
  return (await Notifications.getPermissionsAsync()).granted;
}

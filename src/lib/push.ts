import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

// Show notifications that arrive while the app is open, too.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export type PushPermission = 'granted' | 'denied' | 'undetermined' | 'unavailable';

/** The token this device registered, so it can be removed again on sign-out. */
let registeredToken: string | null = null;

/** Push needs an EAS project id (from `eas init`). */
function projectId(): string | null {
  return Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? null;
}

/** A real phone, or an Android emulator (ones with Google Play can get push; iOS simulators can't). */
function canPush(): boolean {
  return Device.isDevice || Platform.OS === 'android';
}

export async function pushPermission(): Promise<PushPermission> {
  if (!canPush() || !projectId()) return 'unavailable';
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}

/**
 * Asks for permission if needed (`ask`), then registers this phone for the signed-in user.
 * Returns the permission afterwards.
 */
export async function registerForPush({ ask }: { ask: boolean }): Promise<PushPermission> {
  const id = projectId();
  if (!canPush() || !id) return 'unavailable';

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Updates',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
    await Notifications.setNotificationChannelAsync('offers', {
      name: 'Job offers',
      description: 'New offers and reminders. You have a limited time to reply.',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#8A3FFC',
    });
  }

  let { status } = await Notifications.getPermissionsAsync();
  if (status === 'undetermined' && ask) {
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  if (status !== 'granted') return status;

  const token = (await Notifications.getExpoPushTokenAsync({ projectId: id })).data;
  const { error } = await supabase.rpc('register_push_token', {
    p_token: token,
    p_platform: Platform.OS === 'ios' ? 'ios' : 'android',
  });
  if (error) throw error;
  registeredToken = token;
  return status;
}

/** Stops this phone getting the signed-in user's notifications. Call before signing out. */
export async function unregisterPush() {
  if (!registeredToken) return;
  await supabase.rpc('unregister_push_token', { p_token: registeredToken });
  registeredToken = null;
}

/** Opens the screen a notification points to (`data.url`), now and when one is tapped later. */
export function observeNotificationTaps(open: (url: string) => void) {
  function handle(response: Notifications.NotificationResponse | null) {
    const url = response?.notification.request.content.data?.url;
    if (typeof url === 'string') open(url);
  }
  // The tap that opened the app, if it was closed.
  const last = Notifications.getLastNotificationResponse();
  if (last) {
    handle(last);
    // Otherwise the same tap would open the screen again next time.
    Notifications.clearLastNotificationResponse();
  }
  const subscription = Notifications.addNotificationResponseReceivedListener(handle);
  return () => subscription.remove();
}

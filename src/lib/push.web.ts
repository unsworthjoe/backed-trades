// The trade app's push notifications are phone-only. On the website these do nothing.

export type PushPermission = 'granted' | 'denied' | 'undetermined' | 'unavailable';

export async function pushPermission(): Promise<PushPermission> {
  return 'unavailable';
}

export async function registerForPush(_options: { ask: boolean }): Promise<PushPermission> {
  return 'unavailable';
}

export async function unregisterPush() {}

export function observeNotificationTaps(_open: (url: string) => void) {
  return () => {};
}

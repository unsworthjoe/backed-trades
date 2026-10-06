import { router, Stack, type Href } from 'expo-router';
import { useEffect } from 'react';

import { Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { observeNotificationTaps } from '@/lib/push';

export default function TradeLayout() {
  const theme = useTheme();

  // Tapping a notification opens its offer, job or queue.
  useEffect(() => observeNotificationTaps((url) => router.push(url as Href)), []);

  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerBackButtonDisplayMode: 'minimal',
        headerTintColor: theme.text,
        headerStyle: { backgroundColor: theme.background },
        headerTitleStyle: { fontFamily: Fonts.display, fontSize: 18 },
        contentStyle: { backgroundColor: theme.background },
      }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="apply/business" options={{ title: 'Your business' }} />
      <Stack.Screen name="apply/trades" options={{ title: 'Your trades' }} />
      <Stack.Screen name="apply/areas" options={{ title: 'Where you work' }} />
      <Stack.Screen name="apply/registrations" options={{ title: 'Registrations' }} />
      <Stack.Screen name="apply/insurance" options={{ title: 'Insurance' }} />
      <Stack.Screen name="apply/id" options={{ title: 'ID check' }} />
      <Stack.Screen name="offers/[id]" options={{ title: 'Job offer' }} />
      <Stack.Screen name="jobs/[id]" options={{ title: 'Your job' }} />
      <Stack.Screen name="queues" options={{ title: 'Your queues' }} />
    </Stack>
  );
}

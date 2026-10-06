import { Stack } from 'expo-router';

import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';

/**
 * The founders' website, at /admin. Designed for a browser but works anywhere. Admin accounts are
 * invite-only: the email must be in admin_invites before signing up.
 */
export default function AdminLayout() {
  const { session, profile } = useAuth();
  const theme = useTheme();
  const isAdmin = profile?.role === 'admin';

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.background } }}>
      <Stack.Protected guard={isAdmin}>
        <Stack.Screen name="index" options={{ title: 'Applications · Backed. admin' }} />
        <Stack.Screen name="trades/[id]" options={{ title: 'Application · Backed. admin' }} />
        <Stack.Screen name="reports/index" options={{ title: 'Reports · Backed. admin' }} />
        <Stack.Screen name="reports/[id]" options={{ title: 'Report · Backed. admin' }} />
        <Stack.Screen name="reviews" options={{ title: 'Reviews · Backed. admin' }} />
        <Stack.Screen name="alerts" options={{ title: 'Alerts · Backed. admin' }} />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="sign-in" options={{ title: 'Sign in · Backed. admin' }} />
        <Stack.Screen name="sign-up" options={{ title: 'Create account · Backed. admin' }} />
        <Stack.Screen name="verify" options={{ title: 'Check your email · Backed. admin' }} />
        <Stack.Screen name="reset-password" options={{ title: 'Reset your password · Backed. admin' }} />
      </Stack.Protected>
      <Stack.Protected guard={!!session && !isAdmin}>
        <Stack.Screen name="not-allowed" />
      </Stack.Protected>
    </Stack>
  );
}

import { Stack } from 'expo-router';

export default function AuthLayout() {
  // Welcome comes first: on phones, "/" falls through to the first screen here.
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="welcome" options={{ title: 'Join Backed. as a trade' }} />
      <Stack.Screen name="sign-up" options={{ title: 'Create your account · Backed.' }} />
      <Stack.Screen name="sign-in" options={{ title: 'Sign in · Backed.' }} />
      <Stack.Screen name="verify" options={{ title: 'Check your email · Backed.' }} />
      <Stack.Screen name="reset-password" options={{ title: 'Reset your password · Backed.' }} />
    </Stack>
  );
}

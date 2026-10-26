import { Stack } from 'expo-router';

/** The customer website (web only; see the guard in the root layout). */
export default function SiteLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ title: 'Backed. · Vetted local trades in Runcorn, Widnes, Warrington, Northwich, Winsford and Liverpool' }} />
      <Stack.Screen name="post" options={{ title: 'Post a job · Backed.' }} />
      <Stack.Screen name="my-jobs/index" options={{ title: 'My jobs · Backed.' }} />
      <Stack.Screen name="my-jobs/[id]" options={{ title: 'Your job · Backed.' }} />
      <Stack.Screen name="my-jobs/[id]/messages" options={{ title: 'Messages · Backed.' }} />
    </Stack>
  );
}

import { Redirect } from 'expo-router';

import { DeleteAccount } from '@/components/delete-account';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Wordmark } from '@/components/wordmark';
import { useAuth } from '@/lib/auth';

/** Signed in, but not as a trade: admins go to the founders' website; customers use the website. */
export default function OtherAccountScreen() {
  const { profile, signOut } = useAuth();

  if (profile?.role === 'admin') return <Redirect href="/admin" />;

  return (
    <Screen>
      <Wordmark size={32} />
      <ThemedText type="subtitle">This app is for trades</ThemedText>
      <ThemedText themeColor="textSecondary">
        Customers post and manage jobs on the Backed. website, which is coming soon.
      </ThemedText>
      <Button label="Sign out" variant="outline" onPress={signOut} />
      <DeleteAccount isTrade={false} />
    </Screen>
  );
}

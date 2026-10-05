import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Wordmark } from '@/components/wordmark';
import { useAuth } from '@/lib/auth';

export default function NotAllowedScreen() {
  const { signOut } = useAuth();

  return (
    <Screen>
      <Wordmark size={32} />
      <ThemedText type="subtitle">Admins only</ThemedText>
      <ThemedText themeColor="textSecondary">
        This part of Backed. is for the founders. If you should have access, ask a founder to invite your email address,
        then create an account with it.
      </ThemedText>
      <Button label="Sign out" variant="outline" onPress={signOut} />
    </Screen>
  );
}

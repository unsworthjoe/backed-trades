import { useLocalSearchParams } from 'expo-router';

import { VerifyEmailForm } from '@/components/auth-forms';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Wordmark } from '@/components/wordmark';

export default function AdminVerifyScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();

  return (
    <Screen>
      <Wordmark size={32} />
      <ThemedText type="subtitle">Check your email</ThemedText>
      <VerifyEmailForm email={email ?? ''} />
    </Screen>
  );
}

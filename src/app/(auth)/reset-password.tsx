import { router, useLocalSearchParams } from 'expo-router';

import { ResetPasswordForm } from '@/components/auth-forms';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Wordmark } from '@/components/wordmark';

export default function ResetPasswordScreen() {
  const { email } = useLocalSearchParams<{ email?: string }>();

  return (
    <Screen>
      <Wordmark size={32} />
      <ThemedText type="subtitle">Reset your password</ThemedText>
      <ResetPasswordForm initialEmail={email ?? ''} onSignIn={() => router.replace('/sign-in')} />
    </Screen>
  );
}

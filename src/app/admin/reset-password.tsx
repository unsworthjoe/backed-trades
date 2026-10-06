import { router, useLocalSearchParams } from 'expo-router';

import { ResetPasswordForm } from '@/components/auth-forms';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Chip } from '@/components/ui/chip';
import { Wordmark } from '@/components/wordmark';

export default function AdminResetPasswordScreen() {
  const { email } = useLocalSearchParams<{ email?: string }>();

  return (
    <Screen>
      <Wordmark size={32} />
      <Chip label="Admin" tone="brand" />
      <ThemedText type="subtitle">Reset your password</ThemedText>
      <ResetPasswordForm initialEmail={email ?? ''} onSignIn={() => router.replace('/admin/sign-in')} />
    </Screen>
  );
}

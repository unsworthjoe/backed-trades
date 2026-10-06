import { router } from 'expo-router';

import { SignInForm } from '@/components/auth-forms';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Chip } from '@/components/ui/chip';
import { Wordmark } from '@/components/wordmark';

export default function AdminSignInScreen() {
  return (
    <Screen>
      <Wordmark size={32} />
      <Chip label="Admin" tone="brand" />
      <ThemedText type="subtitle">Sign in</ThemedText>
      <SignInForm
        onNeedsCode={(email) => router.push({ pathname: '/admin/verify', params: { email } })}
        onCreateAccount={() => router.replace('/admin/sign-up')}
        onForgotPassword={(email) => router.push({ pathname: '/admin/reset-password', params: { email } })}
      />
    </Screen>
  );
}

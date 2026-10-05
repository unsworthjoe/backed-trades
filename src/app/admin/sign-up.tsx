import { router } from 'expo-router';

import { SignUpForm } from '@/components/auth-forms';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Chip } from '@/components/ui/chip';
import { Wordmark } from '@/components/wordmark';

export default function AdminSignUpScreen() {
  return (
    <Screen>
      <Wordmark size={32} />
      <Chip label="Admin" tone="brand" />
      <ThemedText type="subtitle">Create your admin account</ThemedText>
      <ThemedText themeColor="textSecondary">Use the email address you were invited with.</ThemedText>
      <SignUpForm
        onCodeSent={(email) => router.push({ pathname: '/admin/verify', params: { email } })}
        onSignIn={() => router.replace('/admin/sign-in')}
      />
    </Screen>
  );
}

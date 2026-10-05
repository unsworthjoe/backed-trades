import { router } from 'expo-router';

import { SignInForm } from '@/components/auth-forms';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Wordmark } from '@/components/wordmark';

export default function SignInScreen() {
  return (
    <Screen>
      <Wordmark size={32} />
      <ThemedText type="subtitle">Sign in</ThemedText>
      <SignInForm
        onNeedsCode={(email) => router.push({ pathname: '/verify', params: { email } })}
        onCreateAccount={() => router.replace('/sign-up')}
      />
    </Screen>
  );
}

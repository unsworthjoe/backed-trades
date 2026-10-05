import { router } from 'expo-router';

import { SignUpForm } from '@/components/auth-forms';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Wordmark } from '@/components/wordmark';

export default function SignUpScreen() {
  return (
    <Screen>
      <Wordmark size={32} />
      <ThemedText type="subtitle">Join Backed.</ThemedText>
      <ThemedText themeColor="textSecondary">
        Create your account, then fill in your application at your own pace. One account per business.
      </ThemedText>
      <SignUpForm
        onCodeSent={(email) => router.push({ pathname: '/verify', params: { email } })}
        onSignIn={() => router.replace('/sign-in')}
      />
    </Screen>
  );
}

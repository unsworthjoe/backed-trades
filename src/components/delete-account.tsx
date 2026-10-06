import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Notice } from '@/components/ui/notice';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

const ERRORS: Record<string, string> = {
  MEMBERSHIP_NOT_CANCELLED:
    'We couldn’t cancel your membership just now, so nothing has been deleted. Please try again in a few minutes.',
  ADMIN_ACCOUNT: 'Founders’ accounts are removed by another founder.',
};

/** The function's error code, from a supabase.functions.invoke error. */
async function functionError(error: unknown) {
  const context = (error as { context?: Response }).context;
  const body = context ? await context.json().catch(() => null) : null;
  return (body as { error?: string } | null)?.error ?? 'UNKNOWN';
}

/**
 * "Delete my account", with a confirmation step (Apple requires apps to offer this). The
 * delete-account Edge Function cancels any membership, deletes uploaded files, then the account.
 */
export function DeleteAccount({ isTrade }: { isTrade: boolean }) {
  const { signOut } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    const { error } = await supabase.functions.invoke('delete-account');
    if (error) {
      const code = await functionError(error);
      setError(ERRORS[code] ?? 'We couldn’t delete your account just now. Please try again.');
      setBusy(false);
      return;
    }
    // The account is gone; clear the sign-in left on this device.
    await signOut();
  }

  if (!confirming) {
    return <Button label="Delete my account" variant="secondary" onPress={() => setConfirming(true)} />;
  }

  return (
    <Card>
      <ThemedText type="heading">Delete your account?</ThemedText>
      <ThemedText themeColor="textSecondary">
        {isTrade
          ? 'This can’t be undone. Your membership is cancelled straight away, with no refund for the rest of this period. You leave every queue, and your profile, reviews, jobs, messages and documents are deleted.'
          : 'This can’t be undone. Your jobs, messages, photos and reviews are deleted, and any trade working on a job for you will no longer see it.'}
      </ThemedText>
      {error && <Notice message={error} />}
      <View style={styles.buttons}>
        <Button label={busy ? 'Deleting…' : 'Yes, delete my account'} disabled={busy} onPress={remove} />
        <Button label="Keep my account" variant="outline" disabled={busy} onPress={() => setConfirming(false)} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  buttons: {
    gap: Spacing.two,
  },
});

import type { Session } from '@supabase/supabase-js';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { TextField } from '@/components/ui/text-field';
import { Wordmark } from '@/components/wordmark';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

/**
 * True once the session has passed the second step (an authenticator-app code). Read from the
 * sign-in token for speed; the database makes the real decision (private.is_admin).
 */
export function hasPassedSecondStep(session: Session | null) {
  try {
    const payload = session?.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return !!payload && JSON.parse(atob(payload)).aal === 'aal2';
  } catch {
    return false;
  }
}

type Setup = { factorId: string; qrCode: string | null; secret: string | null };

/**
 * Founders' second sign-in step. First time: scan a QR code with an authenticator app, then enter
 * the code. After that: just enter the code from the app.
 */
export function AdminSecondStep() {
  const { signOut } = useAuth();
  const [setup, setSetup] = useState<Setup | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
      if (cancelled) return;
      if (listError) return setError('We couldn’t start the second step. Please reload the page.');

      const verified = factors.totp[0];
      if (verified) return setSetup({ factorId: verified.id, qrCode: null, secret: null });

      // A set-up that was started and never finished would block a new one.
      for (const stale of factors.all.filter((f) => f.factor_type === 'totp' && f.status === 'unverified')) {
        await supabase.auth.mfa.unenroll({ factorId: stale.id });
      }
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
      if (cancelled) return;
      if (enrollError || !data) return setError('We couldn’t start the second step. Please reload the page.');
      setSetup({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function confirm() {
    if (!setup) return;
    setBusy(true);
    setError(null);
    // On success the session upgrades, and the admin pages open by themselves.
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
      factorId: setup.factorId,
      code: code.trim(),
    });
    setBusy(false);
    if (verifyError) setError('That code didn’t work. Check the code in your app and try again.');
  }

  return (
    <Screen>
      <Wordmark size={32} />
      <ThemedText type="subtitle">{setup?.qrCode ? 'Set up your second step' : 'Enter your code'}</ThemedText>

      {setup?.qrCode && (
        <View style={styles.setup}>
          <ThemedText themeColor="textSecondary">
            Open an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password or similar), add an
            account and scan this code.
          </ThemedText>
          <Image source={{ uri: setup.qrCode }} style={styles.qr} contentFit="contain" accessibilityLabel="QR code to scan with your authenticator app" />
          <ThemedText type="small" themeColor="textSecondary" selectable>
            Can’t scan it? Enter this key instead: {setup.secret}
          </ThemedText>
        </View>
      )}
      {setup && !setup.qrCode && (
        <ThemedText themeColor="textSecondary">Enter the 6-digit code from your authenticator app.</ThemedText>
      )}

      {setup && (
        <TextField
          label="6-digit code"
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          maxLength={6}
          placeholder="123456"
        />
      )}
      {error && <Notice message={error} />}
      <Button
        label={busy ? 'Checking…' : 'Continue'}
        size="large"
        disabled={busy || !setup || code.trim().length !== 6}
        onPress={confirm}
      />
      <Button label="Sign out" variant="outline" onPress={signOut} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  setup: {
    gap: Spacing.three,
  },
  qr: {
    width: 200,
    height: 200,
    alignSelf: 'center',
    backgroundColor: '#ffffff',
  },
});

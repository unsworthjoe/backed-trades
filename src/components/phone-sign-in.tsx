import { FunctionsHttpError } from '@supabase/supabase-js';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Turnstile } from '@/components/turnstile';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

const MESSAGES: Record<string, string> = {
  UK_MOBILES_ONLY: 'Please enter a UK mobile number, starting 07.',
  CAPTCHA_FAILED: 'Please complete the “I’m human” check, then try again.',
  TOO_MANY_FOR_NUMBER: 'Too many codes have been sent to this number. Please try again in an hour.',
  TOO_MANY_FROM_DEVICE: 'Too many codes have been requested from here. Please try again in an hour.',
};

async function requestErrorMessage(error: unknown) {
  if (error instanceof FunctionsHttpError) {
    const body = (await error.context.json().catch(() => ({}))) as { error?: string };
    if (body.error && MESSAGES[body.error]) return MESSAGES[body.error];
  }
  return 'We couldn’t send a code just now. Please try again.';
}

function authErrorMessage(message: string) {
  if (/after \d+ seconds/i.test(message)) return 'Please wait a minute before asking for another code.';
  if (/expired|invalid/i.test(message)) return 'That code is wrong or has expired. Check the text or send a new code.';
  if (/hook/i.test(message)) return 'Please ask for a new code.';
  return 'Something went wrong. Please try again.';
}

/**
 * Customer sign-in: UK mobile number, a Turnstile check, then a 6-digit text code. New numbers
 * get an account automatically. Calls onSignedIn once the code is accepted.
 */
export function PhoneSignIn({ onSignedIn, submitLabel = 'Confirm' }: { onSignedIn: () => void; submitLabel?: string }) {
  const [phone, setPhone] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  // Turnstile tokens work once; changing the key shows a fresh check.
  const [captchaKey, setCaptchaKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode() {
    if (!captchaToken) return setError(MESSAGES.CAPTCHA_FAILED);
    setBusy(true);
    setError(null);
    const { data, error } = await supabase.functions.invoke<{ phone: string }>('request-phone-code', {
      body: { phone, captchaToken },
    });
    setCaptchaToken(null);
    setCaptchaKey((key) => key + 1);
    if (error || !data) {
      setError(await requestErrorMessage(error));
      setBusy(false);
      return;
    }
    const sent = await supabase.auth.signInWithOtp({ phone: data.phone });
    setBusy(false);
    if (sent.error) return setError(authErrorMessage(sent.error.message));
    setSentTo(data.phone);
    setCode('');
  }

  async function verify() {
    if (!sentTo) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.verifyOtp({ phone: sentTo, token: code, type: 'sms' });
    setBusy(false);
    if (error) return setError(authErrorMessage(error.message));
    onSignedIn();
  }

  if (sentTo) {
    return (
      <View style={styles.form}>
        <ThemedText themeColor="textSecondary">
          We’ve texted a 6-digit code to <ThemedText type="smallBold">{sentTo.replace(/^\+44/, '0')}</ThemedText>.
        </ThemedText>
        <TextField
          label="Code"
          value={code}
          onChangeText={(text) => setCode(text.replace(/\D/g, '').slice(0, 6))}
          keyboardType="number-pad"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          onSubmitEditing={verify}
        />
        {error && <Notice message={error} />}
        <Button label={busy ? 'Checking…' : submitLabel} size="large" disabled={busy || code.length !== 6} onPress={verify} />
        <Button label="Use a different number" variant="outline" onPress={() => setSentTo(null)} />
      </View>
    );
  }

  return (
    <View style={styles.form}>
      <TextField
        label="Mobile number"
        hint="We’ll text you a code. Your number is only shared with the trade you’re matched with."
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        placeholder="07700 900123"
      />
      <Turnstile key={captchaKey} onToken={setCaptchaToken} />
      {error && <Notice message={error} />}
      <Button
        label={busy ? 'Sending…' : 'Text me a code'}
        size="large"
        disabled={busy || phone.replace(/\D/g, '').length < 10 || !captchaToken}
        onPress={sendCode}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: Spacing.three,
  },
});

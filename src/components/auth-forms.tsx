import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { friendlyError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

/**
 * Email and password sign-in, sign-up, the 6-digit email code and password reset. Used by the trade app and the
 * admin website; the routes decide where each step goes next. Once Supabase has a session, the
 * route guards in the layouts take the user to the right place.
 */

export function SignInForm({ onNeedsCode, onCreateAccount, onForgotPassword }: {
  onNeedsCode: (email: string) => void;
  onCreateAccount: () => void;
  onForgotPassword: (email: string) => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error?.message.includes('Email not confirmed')) {
      await supabase.auth.resend({ type: 'signup', email: email.trim() });
      onNeedsCode(email.trim());
    } else if (error) {
      setError(friendlyError(error));
    }
  }

  return (
    <View style={styles.form}>
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <TextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        onSubmitEditing={signIn}
      />
      {error && <Notice message={error} />}
      <Button label={busy ? 'Signing in…' : 'Sign in'} size="large" disabled={busy || !email || !password} onPress={signIn} />
      <Button label="Forgot your password?" variant="secondary" onPress={() => onForgotPassword(email.trim())} />
      <Button label="Create an account" variant="outline" onPress={onCreateAccount} />
    </View>
  );
}

export function SignUpForm({ onCodeSent, onSignIn }: {
  onCodeSent: (email: string) => void;
  onSignIn: () => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signUp() {
    if (password.length < 8) {
      setError('Your password needs to be at least 8 characters.');
      return;
    }
    setBusy(true);
    setError(null);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: name.trim() } },
    });
    setBusy(false);
    if (error) setError(friendlyError(error));
    else if (!data.session) onCodeSent(email.trim());
  }

  return (
    <View style={styles.form}>
      <TextField label="Your name" value={name} onChangeText={setName} autoComplete="name" textContentType="name" />
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <TextField
        label="Password"
        hint="At least 8 characters."
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
      />
      {error && <Notice message={error} />}
      <Button
        label={busy ? 'Creating account…' : 'Create account'}
        size="large"
        disabled={busy || !name.trim() || !email || !password}
        onPress={signUp}
      />
      <Button label="I already have an account" variant="outline" onPress={onSignIn} />
    </View>
  );
}

export function VerifyEmailForm({ email }: { email: string }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);

  async function verify() {
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.verifyOtp({ email, token: code.trim(), type: 'email' });
    setBusy(false);
    if (error) setError(friendlyError(error));
  }

  async function resend() {
    setError(null);
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    if (error) setError(friendlyError(error));
    else setResent(true);
  }

  return (
    <View style={styles.form}>
      <ThemedText themeColor="textSecondary">
        We’ve emailed a 6-digit code to <ThemedText type="smallBold">{email}</ThemedText>. It works for an hour.
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
      {resent && <Notice tone="success" message="New code sent. Check your email (and your junk folder)." />}
      <Button label={busy ? 'Checking…' : 'Confirm'} size="large" disabled={busy || code.length !== 6} onPress={verify} />
      <Button label="Send a new code" variant="outline" onPress={resend} />
    </View>
  );
}

/**
 * Two steps on one screen: email, then the 6-digit code and the new password together. A correct
 * code signs the user in and the route guards move them on straight away, so the password is
 * checked before the code and saved in the same press.
 */
export function ResetPasswordForm({ initialEmail, onSignIn }: {
  initialEmail: string;
  onSignIn: () => void;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);

  async function sendCode() {
    setBusy(true);
    setError(null);
    // Supabase answers the same whether or not the email has an account, so the form can't be
    // used to find out who's signed up.
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    setBusy(false);
    if (error) setError(friendlyError(error));
    else setSentTo(email.trim());
  }

  async function resend() {
    if (!sentTo) return;
    setError(null);
    setResent(false);
    const { error } = await supabase.auth.resetPasswordForEmail(sentTo);
    if (error) setError(friendlyError(error));
    else setResent(true);
  }

  async function savePassword() {
    if (!sentTo) return;
    if (password.length < 8) {
      setError('Your password needs to be at least 8 characters.');
      return;
    }
    setBusy(true);
    setError(null);
    const { error: codeError } = await supabase.auth.verifyOtp({ email: sentTo, token: code, type: 'recovery' });
    if (codeError) {
      setBusy(false);
      setError(friendlyError(codeError));
      return;
    }
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) setError(friendlyError(error));
  }

  function changeEmail() {
    setSentTo(null);
    setCode('');
    setResent(false);
    setError(null);
  }

  if (!sentTo) {
    return (
      <View style={styles.form}>
        <ThemedText themeColor="textSecondary">
          Enter the email you signed up with and we’ll send you a code to set a new password.
        </ThemedText>
        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          onSubmitEditing={sendCode}
        />
        {error && <Notice message={error} />}
        <Button label={busy ? 'Sending…' : 'Send me a code'} size="large" disabled={busy || !email.trim()} onPress={sendCode} />
        <Button label="Back to sign in" variant="outline" onPress={onSignIn} />
      </View>
    );
  }

  return (
    <View style={styles.form}>
      <ThemedText themeColor="textSecondary">
        If <ThemedText type="smallBold">{sentTo}</ThemedText> has a Backed. account, we’ve emailed it a 6-digit
        code. It works for an hour.
      </ThemedText>
      <TextField
        label="Code"
        value={code}
        onChangeText={(text) => setCode(text.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
      />
      <TextField
        label="New password"
        hint="At least 8 characters."
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        onSubmitEditing={savePassword}
      />
      {error && <Notice message={error} />}
      {resent && <Notice tone="success" message="New code sent. Check your email (and your junk folder)." />}
      <Button
        label={busy ? 'Saving…' : 'Save new password'}
        size="large"
        disabled={busy || code.length !== 6 || !password}
        onPress={savePassword}
      />
      <Button label="Send a new code" variant="outline" onPress={resend} />
      <Button label="Use a different email" variant="secondary" onPress={changeEmail} />
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: Spacing.three,
  },
});

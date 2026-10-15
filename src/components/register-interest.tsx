import { FunctionsHttpError } from '@supabase/supabase-js';
import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Turnstile } from '@/components/turnstile';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChoiceChip } from '@/components/ui/choice-chip';
import { Notice } from '@/components/ui/notice';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useReferenceData } from '@/lib/use-application';

type Kind = 'customer' | 'trade';

/** Town choice: a town id, or 'elsewhere'. */
type TownChoice = number | 'elsewhere';

const MESSAGES: Record<string, string> = {
  BAD_EMAIL: 'Please check your email address.',
  PICK_A_TRADE: 'Please pick your trade.',
  CAPTCHA_FAILED: 'Please complete the “I’m human” check, then try again.',
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The coming-soon page's sign-up: an email address to be told when Backed. is live nearby. */
export function RegisterInterest() {
  const reference = useReferenceData();
  const [kind, setKind] = useState<Kind | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [town, setTown] = useState<TownChoice | null>(null);
  const [email, setEmail] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  // Turnstile tokens work once; changing the key shows a fresh check.
  const [captchaKey, setCaptchaKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const ready =
    kind !== null && (kind === 'customer' || categoryId !== null) && town !== null && EMAIL.test(email.trim());

  async function submit() {
    if (!captchaToken) return setError(MESSAGES.CAPTCHA_FAILED);
    setBusy(true);
    setError(null);
    const { error } = await supabase.functions.invoke('register-interest', {
      body: {
        email: email.trim(),
        kind,
        categoryId: kind === 'trade' ? categoryId : undefined,
        townId: town === 'elsewhere' ? null : town,
        captchaToken,
      },
    });
    setBusy(false);
    setCaptchaToken(null);
    setCaptchaKey((key) => key + 1);
    if (error) {
      let code: string | undefined;
      if (error instanceof FunctionsHttpError) {
        code = ((await error.context.json().catch(() => ({}))) as { error?: string }).error;
      }
      setError((code && MESSAGES[code]) || 'We couldn’t save that just now. Please try again.');
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <Card style={styles.card}>
        <Notice
          tone="success"
          title="Thanks, you’re on the list"
          message="We’ll email you when Backed. is live in your area. That’s the only email we’ll send."
        />
      </Card>
    );
  }

  return (
    <Card style={styles.card}>
      <View style={styles.intro}>
        <ThemedText type="heading">Register your interest</ThemedText>
        <ThemedText themeColor="textSecondary">Leave your email and we’ll tell you as soon as we’re live.</ThemedText>
      </View>

      <Group label="I’m…">
        <ChoiceChip label="Looking for a tradesperson" selected={kind === 'customer'} onPress={() => setKind('customer')} />
        <ChoiceChip label="A tradesperson" selected={kind === 'trade'} onPress={() => setKind('trade')} />
      </Group>

      {kind === 'trade' && (
        <Group label="Your trade">
          {reference?.categories.map((category) => (
            <ChoiceChip
              key={category.id}
              label={category.name}
              selected={categoryId === category.id}
              onPress={() => setCategoryId(category.id)}
            />
          ))}
        </Group>
      )}

      <Group label={kind === 'trade' ? 'Where you mostly work' : 'Where you live'}>
        {reference?.towns.map((t) => (
          <ChoiceChip key={t.id} label={t.name} selected={town === t.id} onPress={() => setTown(t.id)} />
        ))}
        <ChoiceChip label="Somewhere else" selected={town === 'elsewhere'} onPress={() => setTown('elsewhere')} />
      </Group>

      <TextField
        label="Email address"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        placeholder="you@example.com"
      />
      <Turnstile key={captchaKey} onToken={setCaptchaToken} />
      {error && <Notice message={error} />}
      <Button
        label={busy ? 'Saving…' : 'Keep me posted'}
        size="large"
        disabled={busy || !ready || !captchaToken}
        onPress={submit}
      />
      <ThemedText type="small" themeColor="textSecondary">
        We’ll only use your email to tell you we’re live, and delete it within 12 months. See our{' '}
        <Link href="/privacy">
          <ThemedText type="small" themeColor="primaryText">
            Privacy policy
          </ThemedText>
        </Link>
        .
      </ThemedText>
    </Card>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.group}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <View style={styles.chips}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.three,
  },
  intro: {
    gap: Spacing.one,
  },
  group: {
    gap: Spacing.two,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});

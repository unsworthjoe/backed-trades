import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { DeleteAccount } from '@/components/delete-account';
import { LoadingScreen, Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip, type ChipTone } from '@/components/ui/chip';
import { Notice } from '@/components/ui/notice';
import { ApprovedTradeHome } from '@/components/trade-home';
import { Wordmark } from '@/components/wordmark';
import { Fonts, Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { formatDate } from '@/lib/dates';
import { SCHEME_NAMES } from '@/lib/labels';
import { friendlyError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { useApplication, type Application } from '@/lib/use-application';

type Step = {
  title: string;
  href: Href;
  /** Problem codes (from my_application_problems) that this step fixes. */
  problems: string[];
  /** Shown under the title. */
  detail: (app: Application) => string;
  status?: (app: Application) => { label: string; tone: ChipTone } | null;
  optional?: boolean;
};

const STEPS: Step[] = [
  {
    title: 'Your business',
    href: '/apply/business',
    problems: ['business', 'phone'],
    detail: (app) => app.trade?.business_name ?? 'Name, type of business and contact number',
  },
  {
    title: 'Your trades',
    href: '/apply/trades',
    problems: ['trades'],
    detail: (app) =>
      app.categoryIds.length
        ? `${app.categoryIds.length} trade${app.categoryIds.length === 1 ? '' : 's'} picked`
        : 'The work you do',
  },
  {
    title: 'Where you work',
    href: '/apply/areas',
    problems: ['areas'],
    detail: (app) =>
      app.townIds.length ? `${app.townIds.length} town${app.townIds.length === 1 ? '' : 's'} picked` : 'Runcorn, Widnes, Warrington',
  },
  {
    title: 'Registrations',
    href: '/apply/registrations',
    problems: [],
    optional: true,
    detail: (app) =>
      app.registrations.length
        ? app.registrations.map((r) => SCHEME_NAMES[r.scheme]).join(', ')
        : 'Gas Safe, NICEIC and others, if you have them',
  },
  {
    title: 'Insurance',
    href: '/apply/insurance',
    problems: ['insurance'],
    detail: (app) =>
      app.insurance?.expires_on
        ? `Public liability, expires ${formatDate(app.insurance.expires_on)}`
        : 'Your public liability certificate',
    status: (app) => reviewStatus(app.insurance?.status),
  },
  {
    title: 'ID check',
    href: '/apply/id',
    problems: ['id'],
    detail: () => 'A photo of your ID and a selfie',
    status: (app) =>
      app.idCheck?.result === 'passed'
        ? { label: 'Passed', tone: 'success' }
        : app.idCheck?.result === 'failed'
          ? { label: 'Try again', tone: 'danger' }
          : app.idCheck && !app.idCheck.images_purged_at
            ? { label: 'Waiting for review', tone: 'neutral' }
            : null,
  },
];

function reviewStatus(status: string | undefined): { label: string; tone: ChipTone } | null {
  if (status === 'approved') return { label: 'Approved', tone: 'success' };
  if (status === 'rejected') return { label: 'Not accepted', tone: 'danger' };
  if (status === 'pending') return { label: 'Waiting for review', tone: 'neutral' };
  return null;
}

export default function TradeHomeScreen() {
  const { application, error, reload } = useApplication();
  const { profile, signOut } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (!application) {
    return error ? (
      <Screen>
        <Notice message={friendlyError(error)} />
        <Button label="Try again" onPress={reload} />
      </Screen>
    ) : (
      <LoadingScreen />
    );
  }

  const { trade, problems } = application;
  const firstName = profile?.full_name.split(' ')[0];

  if (trade?.status === 'approved' || trade?.status === 'suspended') {
    return <ApprovedTradeHome />;
  }

  const underReview = trade?.status === 'applied' && !!trade.submitted_at;
  const ready = problems.length === 0;

  async function submit() {
    setSubmitting(true);
    setSubmitError(null);
    const { error } = await supabase.rpc('submit_application');
    setSubmitting(false);
    if (error) setSubmitError(friendlyError(error));
    await reload();
  }

  return (
    <Screen
      footer={
        underReview ? undefined : (
          <>
            {submitError && <Notice message={submitError} />}
            <Button
              label={submitting ? 'Sending…' : trade?.status === 'rejected' ? 'Send it again' : 'Send my application'}
              size="large"
              disabled={!ready || submitting}
              onPress={submit}
            />
          </>
        )
      }>
      <Wordmark size={32} />
      <View style={styles.intro}>
        <ThemedText type="subtitle">
          {underReview ? 'Thanks, we’ve got it' : `Your application${firstName ? `, ${firstName}` : ''}`}
        </ThemedText>
        <ThemedText themeColor="textSecondary">
          {underReview
            ? 'A founder checks every application by hand. We’ll let you know as soon as it’s done.'
            : 'Fill in each part, in any order. Your progress is saved as you go.'}
        </ThemedText>
      </View>

      {underReview && <Notice tone="info" title="Under review" message="You can still update anything below while you wait." />}
      {trade?.status === 'rejected' && (
        <Notice
          tone="warning"
          title="We couldn’t approve your application yet"
          message={`${trade.rejection_reason ?? ''}\n\nFix the part mentioned, then send your application again.`}
        />
      )}

      <Card style={styles.steps}>
        {STEPS.map((step, index) => {
          const done = step.optional
            ? application.registrations.length > 0
            : step.problems.every((code) => !problems.includes(code));
          const locked = !trade && index > 0;
          return (
            <StepRow
              key={step.title}
              number={index + 1}
              title={step.title}
              detail={locked ? 'Fill in your business first' : step.detail(application)}
              done={done}
              optional={step.optional}
              status={step.status?.(application) ?? null}
              disabled={locked}
              onPress={() => router.push(step.href)}
            />
          );
        })}
      </Card>

      <Button label="Sign out" variant="outline" onPress={signOut} />
      <DeleteAccount isTrade />
    </Screen>
  );
}

function StepRow({
  number,
  title,
  detail,
  done,
  optional,
  status,
  disabled,
  onPress,
}: {
  number: number;
  title: string;
  detail: string;
  done: boolean;
  optional?: boolean;
  status: { label: string; tone: ChipTone } | null;
  disabled: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${done ? 'Done' : optional ? 'Optional' : 'To do'}. ${detail}`}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.row, (pressed || disabled) && styles.dimmed]}>
      <View
        style={[
          styles.badge,
          done
            ? { backgroundColor: theme.success }
            : { borderColor: theme.border, borderWidth: 1.5, backgroundColor: theme.surface },
        ]}>
        <ThemedText style={[styles.badgeText, { color: done ? theme.surface : theme.textSecondary }]}>
          {done ? '✓' : number}
        </ThemedText>
      </View>
      <View style={styles.rowText}>
        <ThemedText type="smallBold" style={styles.rowTitle}>
          {title}
          {optional && !done ? (
            <ThemedText type="small" themeColor="textSecondary">
              {'  '}Optional
            </ThemedText>
          ) : null}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
          {detail}
        </ThemedText>
        {status && <Chip label={status.label} tone={status.tone} />}
      </View>
      <ThemedText themeColor="textSecondary" style={styles.chevron}>
        ›
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  intro: {
    gap: Spacing.two,
  },
  steps: {
    gap: 0,
    paddingVertical: Spacing.two,
  },
  row: {
    minHeight: TouchTarget + 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two + 2,
  },
  dimmed: {
    opacity: 0.55,
  },
  badge: {
    width: 32,
    height: 32,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 15,
    lineHeight: 20,
  },
  rowText: {
    flex: 1,
    gap: Spacing.one,
  },
  rowTitle: {
    fontSize: 16,
  },
  chevron: {
    fontSize: 26,
    lineHeight: 30,
  },
});

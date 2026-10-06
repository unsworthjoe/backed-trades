import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { DeleteAccount } from '@/components/delete-account';
import { PhoneSignIn } from '@/components/phone-sign-in';
import { Screen } from '@/components/screen';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Notice } from '@/components/ui/notice';
import { Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { formatDate } from '@/lib/dates';
import { friendlyError } from '@/lib/errors';
import { JOB_STATUS } from '@/lib/labels';
import { supabase } from '@/lib/supabase';

async function loadJobs() {
  const { data, error } = await supabase
    .from('jobs')
    .select('id, title, status, created_at, trade_categories(name), towns(name)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

type Job = Awaited<ReturnType<typeof loadJobs>>[number];

export default function MyJobsScreen() {
  const { session } = useAuth();

  return (
    <Screen>
      <SiteHeader />
      <ThemedText type="subtitle">My jobs</ThemedText>
      {session ? (
        <>
          <JobList />
          <View style={styles.account}>
            <DeleteAccount isTrade={false} />
          </View>
        </>
      ) : (
        <Card>
          <ThemedText themeColor="textSecondary">Sign in with the mobile number you used when you posted.</ThemedText>
          <PhoneSignIn onSignedIn={() => {}} submitLabel="Sign in" />
        </Card>
      )}
      <SiteFooter />
    </Screen>
  );
}

function JobList() {
  const theme = useTheme();
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadJobs()
        .then(setJobs)
        .catch((e) => setError(friendlyError(e)));
    }, []),
  );

  if (error) return <Notice message={error} />;
  if (!jobs) return null;
  if (jobs.length === 0) {
    return (
      <View style={styles.empty}>
        <ThemedText themeColor="textSecondary">You haven’t posted any jobs yet.</ThemedText>
        <Button label="Post a job" onPress={() => router.push('/post')} style={styles.start} />
      </View>
    );
  }

  return (
    <Card style={styles.list}>
      {jobs.map((job, index) => {
        const status = JOB_STATUS[job.status];
        return (
          <Pressable
            key={job.id}
            accessibilityRole="link"
            onPress={() => router.push({ pathname: '/my-jobs/[id]', params: { id: job.id } })}
            style={({ pressed }) => [
              styles.row,
              index > 0 && { borderTopWidth: 1, borderTopColor: theme.border },
              pressed && styles.pressed,
            ]}>
            <View style={styles.rowText}>
              <ThemedText type="smallBold" style={styles.title}>
                {job.title}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {[job.trade_categories?.name, job.towns?.name, `posted ${formatDate(job.created_at)}`].filter(Boolean).join(' · ')}
              </ThemedText>
            </View>
            <Chip label={status.label} tone={status.tone} />
          </Pressable>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  account: {
    marginTop: Spacing.four,
  },
  empty: {
    gap: Spacing.three,
  },
  start: {
    alignSelf: 'flex-start',
  },
  list: {
    gap: 0,
    paddingVertical: Spacing.one,
  },
  row: {
    minHeight: TouchTarget + 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two + 2,
  },
  pressed: {
    opacity: 0.6,
  },
  rowText: {
    flex: 1,
    gap: Spacing.half,
  },
  title: {
    fontSize: 16,
  },
});

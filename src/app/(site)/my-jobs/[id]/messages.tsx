import { Link, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { MessageThread } from '@/components/message-thread';
import { PhoneSignIn } from '@/components/phone-sign-in';
import { LoadingScreen, Screen } from '@/components/screen';
import { SiteHeader } from '@/components/site-header';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Notice } from '@/components/ui/notice';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

type Thread = { matchId: string; tradeName: string; jobTitle: string; live: boolean };

/** The customer's messages with their trade (id = job id). */
export default function CustomerMessagesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const [thread, setThread] = useState<Thread | null | undefined>(undefined);

  useEffect(() => {
    if (!session) return;
    (async () => {
      const [job, match] = await Promise.all([
        supabase.from('jobs').select('title, status').eq('id', id).maybeSingle(),
        supabase.from('job_matches').select('id').eq('job_id', id).is('ended_at', null).maybeSingle(),
      ]);
      if (!job.data || !match.data) {
        setThread(null);
        return;
      }
      const contact = (await supabase.rpc('get_match_contact', { p_match_id: match.data.id })).data?.[0];
      setThread({
        matchId: match.data.id,
        tradeName: contact?.trade_business_name ?? 'your trade',
        jobTitle: job.data.title,
        live: job.data.status !== 'cancelled',
      });
    })();
  }, [id, session]);

  if (!session) {
    return (
      <Screen>
        <SiteHeader />
        <ThemedText type="subtitle">Sign in to see your messages</ThemedText>
        <Card>
          <PhoneSignIn onSignedIn={() => {}} submitLabel="Sign in" />
        </Card>
      </Screen>
    );
  }
  if (thread === undefined) return <LoadingScreen />;
  if (thread === null) {
    return (
      <Screen>
        <SiteHeader />
        <Notice tone="info" message="There are no messages for this job yet. You can message your trade once one has accepted it." />
      </Screen>
    );
  }

  return (
    <MessageThread
      matchId={thread.matchId}
      myId={session.user.id}
      otherName={thread.tradeName}
      canSend={thread.live}
      header={
        <View style={styles.header}>
          <SiteHeader />
          <Link href={{ pathname: '/my-jobs/[id]', params: { id } }}>
            <ThemedText type="link">‹ Back to {thread.jobTitle}</ThemedText>
          </Link>
          <ThemedText type="subtitle">Messages with {thread.tradeName}</ThemedText>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.three,
    marginBottom: Spacing.two,
  },
});

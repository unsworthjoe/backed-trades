import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { LoadingScreen, Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { RatingSummary, ReviewList, TradeChecks } from '@/components/trade-profile-view';
import { Card } from '@/components/ui/card';
import { Notice } from '@/components/ui/notice';
import { useAuth } from '@/lib/auth';
import { friendlyError } from '@/lib/errors';
import { loadTradeProfile, type TradeProfile } from '@/lib/trade-profile';

/** The trade's own reviews and checks: what customers see about them. */
export default function ReviewsScreen() {
  const { session } = useAuth();
  const [profile, setProfile] = useState<TradeProfile | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setProfile(await loadTradeProfile(session!.user.id));
    } catch (e) {
      setError(friendlyError(e));
    }
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  if (profile === undefined) {
    return error ? (
      <Screen edges={['left', 'right']}>
        <Notice message={error} />
      </Screen>
    ) : (
      <LoadingScreen />
    );
  }
  if (!profile) {
    return (
      <Screen edges={['left', 'right']}>
        <Notice tone="info" message="Your reviews will show here once your account is active." />
      </Screen>
    );
  }

  return (
    <Screen edges={['left', 'right']} onRefresh={reload}>
      <ThemedText themeColor="textSecondary">
        This is what customers see about you when you take their job. Reviews appear once you’ve both rated each
        other, or 14 days after the job is completed.
      </ThemedText>

      <Card>
        <ThemedText type="heading">Your rating</ThemedText>
        <RatingSummary profile={profile} />
      </Card>

      <Card>
        <ThemedText type="heading">Checks customers see</ThemedText>
        <TradeChecks profile={profile} />
      </Card>

      {profile.reviews.length > 0 && <ReviewList profile={profile} />}
    </Screen>
  );
}

import { StyleSheet, View } from 'react-native';

import { Stars } from '@/components/stars';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDate } from '@/lib/dates';
import { SCHEME_NAMES } from '@/lib/labels';
import type { TradeProfile } from '@/lib/trade-profile';

/** The checks Backed. has done on a trade, as ticked lines. */
export function TradeChecks({ profile }: { profile: TradeProfile }) {
  const checks = [
    profile.id_checked && 'Photo ID checked',
    profile.insured_until && `Public liability insurance, until ${formatDate(profile.insured_until)}`,
    profile.company_checked && 'Checked at Companies House',
    ...profile.registrations.map((scheme) => `${SCHEME_NAMES[scheme] ?? scheme} registered`),
    'Approved by the Backed. team',
  ].filter(Boolean) as string[];

  return (
    <View style={styles.list}>
      {checks.map((check) => (
        <CheckLine key={check} label={check} />
      ))}
    </View>
  );
}

function CheckLine({ label }: { label: string }) {
  const theme = useTheme();
  return (
    <View style={styles.check}>
      <ThemedText type="smallBold" style={{ color: theme.success }}>
        ✓
      </ThemedText>
      <ThemedText type="small" style={styles.flex}>
        {label}
      </ThemedText>
    </View>
  );
}

/** Average rating, with the four parts, or "No reviews yet". */
export function RatingSummary({ profile }: { profile: TradeProfile }) {
  const { rating } = profile;
  if (!rating.count || rating.overall === null) {
    return (
      <ThemedText type="small" themeColor="textSecondary">
        No reviews yet{profile.jobs_completed ? `, ${profile.jobs_completed} job${profile.jobs_completed === 1 ? '' : 's'} completed` : ''}.
      </ThemedText>
    );
  }
  const parts: [string, number | null][] = [
    ['Quality', rating.quality],
    ['Reliability', rating.reliability],
    ['Tidiness', rating.tidiness],
    ['Value', rating.value],
  ];
  return (
    <View style={styles.list}>
      <Stars value={rating.overall} count={rating.count} />
      <ThemedText type="small" themeColor="textSecondary">
        {parts.map(([name, value]) => `${name} ${value?.toFixed(1)}`).join(' · ')}
      </ThemedText>
    </View>
  );
}

/** The latest reviews, newest first. */
export function ReviewList({ profile, limit }: { profile: TradeProfile; limit?: number }) {
  const reviews = limit ? profile.reviews.slice(0, limit) : profile.reviews;
  return (
    <View style={styles.reviews}>
      {reviews.map((review) => (
        <Card key={`${review.created_at}-${review.first_name}`}>
          <Stars value={review.overall} />
          {review.comment ? <ThemedText>“{review.comment}”</ThemedText> : null}
          <ThemedText type="small" themeColor="textSecondary">
            {[review.first_name, review.town, review.job_title, formatDate(review.created_at)].filter(Boolean).join(' · ')}
          </ThemedText>
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  list: {
    gap: Spacing.one,
  },
  check: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  reviews: {
    gap: Spacing.two,
  },
});

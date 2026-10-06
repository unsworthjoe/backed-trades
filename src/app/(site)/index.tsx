import { Link, router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { PageMeta } from '@/components/page-meta';
import { Screen } from '@/components/screen';
import { SiteHeader } from '@/components/site-header';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Spacing } from '@/constants/theme';

const STEPS = [
  ['Tell us what you need', 'Pick the trade, add a few details and photos. It takes a couple of minutes and it’s free.'],
  ['We find you one trade', 'Your job goes to vetted local trades, in turn. The first to accept gets in touch within 24 hours.'],
  ['Get it done, then review', 'Sign the job off when it’s finished and leave an honest review to help your neighbours.'],
] as const;

const TRUST = [
  'ID-checked by a real person',
  'Public liability insurance checked',
  'Gas Safe, NICEIC and other registrations checked',
  'Reviews only from customers they’ve worked for',
] as const;

export default function HomeScreen() {
  return (
    <Screen>
      <PageMeta
        title="Backed. · Vetted local trades in Runcorn, Widnes and Warrington"
        description="Post your job once and Backed. matches you with one vetted, insured local tradesperson in Runcorn, Widnes or Warrington. Free for customers, with no competing quotes or sales calls."
        path="/"
      />
      <SiteHeader />

      <View style={styles.hero}>
        <ThemedText type="title">Find a vetted local trade, without the ring-round.</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.lead}>
          Post your job once. We match you with one trusted tradesperson in Runcorn, Widnes or Warrington. No
          competing quotes, no sales calls.
        </ThemedText>
        <Button label="Post a job" size="large" onPress={() => router.push('/post')} style={styles.cta} />
      </View>

      <View style={styles.steps}>
        {STEPS.map(([title, body], index) => (
          <Card key={title} style={styles.step}>
            <ThemedText type="label" themeColor="primaryText">
              Step {index + 1}
            </ThemedText>
            <ThemedText type="heading">{title}</ThemedText>
            <ThemedText themeColor="textSecondary">{body}</ThemedText>
          </Card>
        ))}
      </View>

      <Card inverse>
        <ThemedText type="heading" themeColor="textOnInverse">
          Every trade on Backed. is
        </ThemedText>
        {TRUST.map((line) => (
          <ThemedText key={line} themeColor="textOnInverse">
            ✓ {line}
          </ThemedText>
        ))}
      </Card>

      <View style={styles.trade}>
        <ThemedText themeColor="textSecondary">Are you a tradesperson?</ThemedText>
        <Link href="/welcome">
          <ThemedText type="link">Join Backed. →</ThemedText>
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: Spacing.three,
    paddingTop: Spacing.four,
  },
  lead: {
    fontSize: 18,
    lineHeight: 27,
  },
  cta: {
    alignSelf: 'flex-start',
  },
  steps: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  step: {
    flexGrow: 1,
    flexBasis: 220,
  },
  trade: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    alignItems: 'center',
  },
});

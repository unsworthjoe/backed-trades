import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { PageMeta } from '@/components/page-meta';
import { Screen } from '@/components/screen';
import { SiteFooter } from '@/components/site-footer';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Wordmark } from '@/components/wordmark';
import { Spacing } from '@/constants/theme';

const POINTS = [
  ['One flat price', '£14.99 a month for founding members in Runcorn, Widnes and Warrington. No paying per lead.'],
  ['A fair queue', 'Jobs go to the front of the queue. Win one and you go to the back, so everyone gets a turn.'],
  ['Every trade vetted', 'ID, insurance and registrations checked by hand, so customers can trust who turns up.'],
] as const;

export default function WelcomeScreen() {
  return (
    <Screen
      footer={
        <>
          <Button label="Join as a trade" size="large" onPress={() => router.push('/sign-up')} />
          <Button label="Sign in" variant="outline" onPress={() => router.push('/sign-in')} />
        </>
      }>
      <PageMeta
        title="Join Backed. · Local jobs for tradespeople in Runcorn, Widnes and Warrington"
        description="Backed. is built by tradespeople, for tradespeople: one flat monthly price, no paying per lead, and a fair queue so every vetted local trade gets a turn at jobs."
        path="/welcome"
      />
      <View style={styles.hero}>
        <Wordmark size={56} />
        <ThemedText type="title">By tradespeople, for tradespeople.</ThemedText>
      </View>
      <View style={styles.points}>
        {POINTS.map(([title, body]) => (
          <Card key={title}>
            <ThemedText type="heading">{title}</ThemedText>
            <ThemedText themeColor="textSecondary">{body}</ThemedText>
          </Card>
        ))}
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        Applying is free. You only subscribe once you’ve been approved.
      </ThemedText>
      <SiteFooter />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: Spacing.three,
    paddingTop: Spacing.five,
  },
  points: {
    gap: Spacing.three,
  },
});

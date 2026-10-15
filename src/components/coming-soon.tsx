import Head from 'expo-router/head';
import { Platform, StyleSheet, View } from 'react-native';

import { RegisterInterest } from '@/components/register-interest';
import { Screen } from '@/components/screen';
import { SiteFooter } from '@/components/site-footer';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Wordmark } from '@/components/wordmark';
import { Spacing } from '@/constants/theme';

/**
 * Before launch, backedtrades.co.uk shows a "coming soon" page on every address except the
 * privacy policy, terms and help page (the app stores need those). It's the same website exported with the
 * switch on:
 *   EXPO_PUBLIC_HOLDING_PAGE=1 npx expo export --platform web --output-dir dist-holding --clear
 * Always export with --clear when switching between the two: the build cache doesn't notice the
 * setting change, and a real-site build once came out showing "coming soon".
 */
export const HOLDING_PAGE = Platform.OS === 'web' && process.env.EXPO_PUBLIC_HOLDING_PAGE === '1';

/** Pages shown as normal on the holding site. */
export const HOLDING_PAGE_EXCEPTIONS = new Set(['/privacy', '/terms', '/support']);

/**
 * The holding page on backedtrades.co.uk before launch. The website build shows it on every
 * address when EXPO_PUBLIC_HOLDING_PAGE=1 is set at export time (see RootLayout).
 */
export function ComingSoon() {
  return (
    <>
      <Head>
        <title>Backed. · Coming soon to Runcorn, Widnes and Warrington</title>
        <meta
          name="description"
          content="Backed. matches you with one vetted local tradesperson. Coming soon to Runcorn, Widnes and Warrington."
        />
      </Head>
      <Screen>
        <Wordmark size={44} />

        <View style={styles.hero}>
          <ThemedText type="label" themeColor="primaryText">
            Coming soon
          </ThemedText>
          <ThemedText type="title">Vetted local trades, without the ring-round.</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.lead}>
            Backed. is launching in Runcorn, Widnes and Warrington. Post your job once and we’ll match you with one
            trusted tradesperson, checked by a real person.
          </ThemedText>
        </View>

        <View style={styles.cards}>
          <Card style={styles.card}>
            <ThemedText type="heading">Need a job doing?</ThemedText>
            <ThemedText themeColor="textSecondary">
              Every trade is ID-checked, insured and approved by our team. Reviews only come from customers they’ve
              worked for. Free for customers.
            </ThemedText>
          </Card>
          <Card style={styles.card}>
            <ThemedText type="heading">Are you a tradesperson?</ThemedText>
            <ThemedText themeColor="textSecondary">
              No bidding for leads. One flat membership, a fair queue for every job, and a founding member price for
              the first trades in each town.
            </ThemedText>
          </Card>
        </View>
        <RegisterInterest />
        <SiteFooter />
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: Spacing.three,
    marginTop: Spacing.four,
  },
  lead: {
    fontSize: 18,
    lineHeight: 28,
  },
  cards: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  card: {
    flexGrow: 1,
    flexBasis: 280,
  },
});

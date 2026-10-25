import Head from 'expo-router/head';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { RegisterInterest } from '@/components/register-interest';
import { Screen } from '@/components/screen';
import { SiteFooter } from '@/components/site-footer';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Company } from '@/constants/company';
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
  const [registerOpen, setRegisterOpen] = useState(false);

  return (
    <>
      <Head>
        <title>Backed. · Vetted local trades in Runcorn, Widnes and Warrington</title>
        <meta
          name="description"
          content="Backed. matches you with one vetted local tradesperson, checked by a real person. Launching soon in Runcorn, Widnes and Warrington."
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

        <View style={styles.register}>
          <Button
            label={registerOpen ? 'Hide the sign-up form' : 'Register your interest'}
            size="large"
            accessibilityState={{ expanded: registerOpen }}
            onPress={() => setRegisterOpen((open) => !open)}
          />
          {registerOpen && <RegisterInterest />}
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

        <Section title="How it works">
          <Card style={styles.card}>
            <ThemedText type="heading">For customers</ThemedText>
            <Step n={1} text="Tell us what you need doing, where, and when. It’s free and takes a couple of minutes." />
            <Step n={2} text="We offer your job to local tradespeople in turn and match you with the first one who accepts." />
            <Step n={3} text="Chat in the app, get the job done, then sign it off and leave an honest review." />
          </Card>
          <Card style={styles.card}>
            <ThemedText type="heading">For tradespeople</ThemedText>
            <Step n={1} text="Apply and get checked: ID, insurance and any registrations you hold." />
            <Step n={2} text="Join for one flat monthly membership. No paying per lead and no commission on your work." />
            <Step n={3} text="Jobs near you are offered in a fair queue. Accept the ones you want and get the customer’s details." />
          </Card>
        </Section>

        <Section title="Checked by a real person">
          <Card style={styles.wide}>
            <ThemedText themeColor="textSecondary">
              Before a tradesperson can take any work, a member of our team checks their ID and their public
              liability insurance, plus registrations such as Gas Safe, NICEIC, NAPIT, FENSA, CERTASS or OFTEC where
              they apply. We keep checking: offers stop if insurance runs out. Reviews can only be left by customers
              the trade has actually worked for.
            </ThemedText>
          </Card>
        </Section>

        <Section title="Where we’re starting">
          <Card style={styles.wide}>
            <ThemedText themeColor="textSecondary">
              Runcorn, Widnes and Warrington. We’re a small local team, made by tradespeople for tradespeople, and
              we’d rather get it right in three towns than rush into thirty.
            </ThemedText>
          </Card>
        </Section>

        <Section title="About us">
          <Card style={styles.wide}>
            <ThemedText themeColor="textSecondary">
              Backed. is run by {Company.name}, a company registered in {Company.registeredIn} (company number{' '}
              {Company.number}). Questions? Email us at {Company.supportEmail}.
            </ThemedText>
          </Card>
        </Section>

        <SiteFooter />
      </Screen>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText type="subtitle">{title}</ThemedText>
      <View style={styles.cards}>{children}</View>
    </View>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <View style={styles.step}>
      <ThemedText type="smallBold" themeColor="primaryText">
        {n}.
      </ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.stepText}>
        {text}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.three,
  },
  wide: {
    flexGrow: 1,
    flexBasis: '100%',
  },
  step: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  stepText: {
    flex: 1,
  },
  hero: {
    gap: Spacing.three,
    marginTop: Spacing.four,
  },
  lead: {
    fontSize: 18,
    lineHeight: 28,
  },
  register: {
    gap: Spacing.three,
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

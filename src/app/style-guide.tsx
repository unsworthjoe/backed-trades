import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { TextField } from '@/components/ui/text-field';
import { Wordmark } from '@/components/wordmark';
import { MaxContentWidth, Radius, Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Temporary style guide for judging the Backed. theme on a real phone.
 * Kept at /style-guide for checking the theme; not linked from the app.
 */

const SWATCHES: { token: ThemeColor; name: string }[] = [
  { token: 'primary', name: 'Brand' },
  { token: 'primaryText', name: 'Brand text' },
  { token: 'primaryTint', name: 'Brand tint' },
  { token: 'text', name: 'Ink' },
  { token: 'textSecondary', name: 'Secondary' },
  { token: 'background', name: 'Background' },
  { token: 'surface', name: 'Card' },
  { token: 'border', name: 'Border' },
];

const QUEUE_SEGMENTS = 8;
const QUEUE_FILLED = 5;

export default function StyleGuideScreen() {
  const theme = useTheme();

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Wordmark size={30} />
          <Chip label="Style guide" tone="brand" />
        </View>

        <Section title="Logo">
          <Card style={styles.logoCard}>
            <Wordmark size={56} />
          </Card>
          <Card inverse style={styles.logoCard}>
            <Wordmark size={40} inverse />
          </Card>
        </Section>

        <Section title="Colours">
          <View style={styles.swatches}>
            {SWATCHES.map((s) => (
              <View key={s.token} style={styles.swatch}>
                <View style={[styles.swatchColor, { backgroundColor: theme[s.token], borderColor: theme.border }]} />
                <ThemedText type="smallBold">{s.name}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {theme[s.token]}
                </ThemedText>
              </View>
            ))}
          </View>
        </Section>

        <Section title="Type">
          <Card>
            <ThemedText type="title">By tradespeople, for tradespeople.</ThemedText>
            <ThemedText type="subtitle">Leaking kitchen tap</ThemedText>
            <ThemedText type="heading">Your place in the queue</ThemedText>
            <ThemedText>
              Every trade on Backed. is ID-checked and insured, and reviewed only by customers they&apos;ve actually
              worked for.
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Widnes, WA8 · 2.1 miles away · This week
            </ThemedText>
            <ThemedText type="label" themeColor="primaryText">
              New job offer
            </ThemedText>
            <ThemedText type="link">Sign in</ThemedText>
          </Card>
        </Section>

        <Section title="Trade app: queue and job offer">
          <Card inverse>
            <View style={styles.spread}>
              <ThemedText type="smallBold" style={{ color: theme.textSecondaryOnInverse }}>
                Your place in the queue
              </ThemedText>
              <ThemedText type="smallBold" style={{ color: theme.textSecondaryOnInverse }}>
                Plumbers · Widnes
              </ThemedText>
            </View>
            <View style={styles.queueRow}>
              <ThemedText type="title" style={[styles.queueNumber, { color: theme.primaryOnInverse }]}>
                4th
              </ThemedText>
              <ThemedText style={{ color: theme.textOnInverse }}>about 5 days to go</ThemedText>
            </View>
            <View style={styles.segments}>
              {Array.from({ length: QUEUE_SEGMENTS }, (_, i) => (
                <View
                  key={i}
                  style={[styles.segment, { backgroundColor: i < QUEUE_FILLED ? theme.primaryOnInverse : theme.trackOnInverse }]}
                />
              ))}
            </View>
          </Card>

          <Card>
            <View style={styles.spread}>
              <ThemedText type="label" themeColor="primaryText">
                New job offer
              </ThemedText>
              <Chip label="Reply in 1h 48m" tone="brand" />
            </View>
            <ThemedText type="subtitle">Leaking kitchen tap</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Widnes, WA8 · 2.1 miles away · This week
            </ThemedText>
            <ThemedText>
              Mixer tap drips constantly and there&apos;s water under the sink. Happy for you to replace it if needed.
            </ThemedText>
            <View style={styles.buttonRow}>
              <Button label="Accept job" style={styles.flex} />
              <Button label="Decline" variant="secondary" />
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              Offered to 3 trades. The first to accept gets the job. The others keep their place.
            </ThemedText>
          </Card>
        </Section>

        <Section title="Status chips">
          <View style={styles.chips}>
            <Chip label="Vetted" tone="success" />
            <Chip label="Insurance expires soon" tone="warning" />
            <Chip label="Declined" tone="danger" />
            <Chip label="Under review" tone="info" />
            <Chip label="Paused" tone="neutral" />
          </View>
        </Section>

        <Section title="Form fields and buttons">
          <Card>
            <TextField label="Describe the job" placeholder="e.g. Kitchen tap is leaking under the sink" multiline />
            <TextField label="Postcode" placeholder="e.g. WA7 1AB" autoCapitalize="characters" hint="We only share your town with trades until you're matched." />
            <Button label="Find me a vetted trade" size="large" />
            <Button label="Pause my offers" variant="outline" />
          </Card>
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText type="label" themeColor="textSecondary">
        {title}
      </ThemedText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    padding: Spacing.four - 4,
    paddingBottom: Spacing.six,
    gap: Spacing.five,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  section: {
    gap: Spacing.three - 4,
  },
  logoCard: {
    alignItems: 'center',
    paddingVertical: Spacing.five,
  },
  swatches: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three - 4,
  },
  swatch: {
    width: 76,
    gap: Spacing.one,
  },
  swatchColor: {
    height: 44,
    borderRadius: Radius.small,
    borderWidth: StyleSheet.hairlineWidth,
  },
  spread: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  queueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.two + 2,
  },
  queueNumber: {
    fontSize: 52,
    lineHeight: 56,
  },
  segments: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
  segment: {
    flex: 1,
    height: 6,
    borderRadius: 3,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.two + 2,
    paddingTop: Spacing.one,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});

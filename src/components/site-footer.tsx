import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Company } from '@/constants/company';
import { Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Bottom of the public pages: the legal links and the company details UK law asks for. */
export function SiteFooter() {
  const theme = useTheme();
  const office = Company.registeredOffice ? ` Registered office: ${Company.registeredOffice}.` : '';

  return (
    <View style={[styles.footer, { borderTopColor: theme.border }]}>
      <View style={styles.links}>
        <Link href="/support" style={styles.link}>
          <ThemedText type="small" themeColor="textSecondary">
            Help and contact
          </ThemedText>
        </Link>
        <Link href="/privacy" style={styles.link}>
          <ThemedText type="small" themeColor="textSecondary">
            Privacy policy
          </ThemedText>
        </Link>
        <Link href="/terms" style={styles.link}>
          <ThemedText type="small" themeColor="textSecondary">
            Terms
          </ThemedText>
        </Link>
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        Backed. is run by {Company.name}, registered in {Company.registeredIn}, company number {Company.number}.
        {office}
      </ThemedText>
    </View>
  );
}

/** "By …, you agree to our Terms and Privacy policy", under a button that creates an account. */
export function AgreeToTerms({ action }: { action: string }) {
  return (
    <ThemedText type="small" themeColor="textSecondary">
      By {action}, you agree to our{' '}
      <Link href="/terms">
        <ThemedText type="small" themeColor="primaryText">
          Terms
        </ThemedText>
      </Link>{' '}
      and{' '}
      <Link href="/privacy">
        <ThemedText type="small" themeColor="primaryText">
          Privacy policy
        </ThemedText>
      </Link>
      .
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  footer: {
    borderTopWidth: 1,
    paddingTop: Spacing.three,
    marginTop: Spacing.four,
    gap: Spacing.two,
  },
  links: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.four,
  },
  link: {
    minHeight: TouchTarget,
    justifyContent: 'center',
  },
});

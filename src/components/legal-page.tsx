import { Link } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';

import { HOLDING_PAGE } from '@/components/coming-soon';
import { PageMeta } from '@/components/page-meta';
import { Screen } from '@/components/screen';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { ThemedText } from '@/components/themed-text';
import { Wordmark } from '@/components/wordmark';
import { LegalUpdated } from '@/constants/company';
import { Spacing } from '@/constants/theme';

/** A paragraph, or a bulleted list. */
export type LegalBlock = string | { list: string[] };
export type LegalSection = { heading: string; body: LegalBlock[] };

type LegalPageProps = {
  title: string;
  description: string;
  path: string;
  intro: string;
  sections: LegalSection[];
  /** "Last updated" date; null hides it (the help page). */
  updated?: string | null;
  /** Number the section headings, as legal pages do. */
  numbered?: boolean;
};

/**
 * The privacy policy, terms and help page. On the website it has the site's header and footer (just the logo
 * while the coming-soon page is up, as there's no sign-in then); in the app it opens over the
 * current screen with a back button (see the root layout).
 */
export function LegalPage({
  title,
  description,
  path,
  intro,
  sections,
  updated = LegalUpdated,
  numbered = true,
}: LegalPageProps) {
  const isWeb = Platform.OS === 'web';
  return (
    <Screen edges={isWeb ? undefined : ['left', 'right']}>
      <PageMeta title={`${title} · Backed.`} description={description} path={path} />
      {isWeb &&
        (HOLDING_PAGE ? (
          <Link href="/" accessibilityLabel="Backed. home">
            <Wordmark size={28} />
          </Link>
        ) : (
          <SiteHeader />
        ))}
      <View style={styles.top}>
        <ThemedText type="title">{title}</ThemedText>
        {updated && (
          <ThemedText type="small" themeColor="textSecondary">
            Last updated {updated}
          </ThemedText>
        )}
        <ThemedText themeColor="textSecondary">{intro}</ThemedText>
      </View>
      {sections.map((section, index) => (
        <View key={section.heading} style={styles.section}>
          <ThemedText type="heading" accessibilityRole="header">
            {numbered ? `${index + 1}. ${section.heading}` : section.heading}
          </ThemedText>
          {section.body.map((block, i) =>
            typeof block === 'string' ? (
              <ThemedText key={i}>{block}</ThemedText>
            ) : (
              <View key={i} style={styles.list}>
                {block.list.map((item) => (
                  <View key={item} style={styles.item}>
                    <ThemedText>•</ThemedText>
                    <ThemedText style={styles.itemText}>{item}</ThemedText>
                  </View>
                ))}
              </View>
            ),
          )}
        </View>
      ))}
      <SiteFooter />
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: {
    gap: Spacing.two,
    paddingTop: Spacing.two,
  },
  section: {
    gap: Spacing.two,
  },
  list: {
    gap: Spacing.one,
  },
  item: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingLeft: Spacing.one,
  },
  itemText: {
    flex: 1,
  },
});

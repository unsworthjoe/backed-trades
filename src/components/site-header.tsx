import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Wordmark } from '@/components/wordmark';
import { Spacing, TouchTarget } from '@/constants/theme';
import { useAuth } from '@/lib/auth';

/** Top bar for the customer website. */
export function SiteHeader() {
  const { session, signOut } = useAuth();

  return (
    <View style={styles.bar}>
      <Link href="/" accessibilityLabel="Backed. home">
        <Wordmark size={28} />
      </Link>
      <View style={styles.links}>
        <Link href="/post" style={styles.link}>
          <ThemedText type="link">Post a job</ThemedText>
        </Link>
        <Link href="/my-jobs" style={styles.link}>
          <ThemedText type="link">My jobs</ThemedText>
        </Link>
        {session && (
          <Pressable accessibilityRole="button" onPress={signOut} style={styles.link}>
            <ThemedText type="link" themeColor="textSecondary">
              Sign out
            </ThemedText>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  links: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.four,
  },
  link: {
    minHeight: TouchTarget,
    justifyContent: 'center',
  },
});

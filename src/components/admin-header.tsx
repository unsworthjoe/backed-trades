import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Wordmark } from '@/components/wordmark';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';

/** Top bar for the admin website: logo, who's signed in, and sign out. */
export function AdminHeader({ back }: { back?: boolean }) {
  const { profile, signOut } = useAuth();

  return (
    <View style={styles.bar}>
      <View style={styles.brand}>
        <Wordmark size={26} />
        <Chip label="Admin" tone="brand" />
      </View>
      <View style={styles.actions}>
        {profile?.full_name ? (
          <ThemedText type="small" themeColor="textSecondary">
            {profile.full_name}
          </ThemedText>
        ) : null}
        {back && <Button label="All applications" variant="outline" onPress={() => router.navigate('/admin')} />}
        <Button label="Sign out" variant="secondary" onPress={signOut} />
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
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.two,
  },
});

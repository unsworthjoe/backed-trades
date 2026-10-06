import { router, useFocusEffect, usePathname } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Wordmark } from '@/components/wordmark';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

const SECTIONS = [
  { href: '/admin/alerts', label: 'Alerts', match: (path: string) => path.startsWith('/admin/alerts') },
  { href: '/admin', label: 'Applications', match: (path: string) => path === '/admin' || path.startsWith('/admin/trades') },
  { href: '/admin/reports', label: 'Reports', match: (path: string) => path.startsWith('/admin/reports') },
  { href: '/admin/reviews', label: 'Reviews', match: (path: string) => path.startsWith('/admin/reviews') },
] as const;

/** Top bar for the admin website: logo, the sections, who's signed in, and sign out. */
export function AdminHeader() {
  const { profile, signOut } = useAuth();
  const path = usePathname();
  const [open, setOpen] = useState<Record<string, number>>({});

  useFocusEffect(
    useCallback(() => {
      Promise.all([
        supabase.from('admin_alerts').select('id', { count: 'exact', head: true }).is('resolved_at', null),
        supabase.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'open'),
      ]).then(([alerts, reports]) =>
        setOpen({ '/admin/alerts': alerts.count ?? 0, '/admin/reports': reports.count ?? 0 }),
      );
    }, []),
  );

  return (
    <View style={styles.header}>
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
          <Button label="Sign out" variant="secondary" onPress={signOut} />
        </View>
      </View>
      <View style={styles.nav} accessibilityRole="tablist">
        {SECTIONS.map((section) => (
          <Button
            key={section.href}
            accessibilityRole="tab"
            accessibilityState={{ selected: section.match(path) }}
            label={open[section.href] ? `${section.label} (${open[section.href]} open)` : section.label}
            variant={section.match(path) ? 'primary' : 'outline'}
            onPress={() => router.navigate(section.href)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.three,
  },
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
  nav: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});

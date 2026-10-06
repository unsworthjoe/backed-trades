import { useState, type ReactNode } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ScreenProps = {
  children: ReactNode;
  /** Pinned below the scrolling content, e.g. a Save button. */
  footer?: ReactNode;
  /** Leave out 'top' when the screen has a navigation header. */
  edges?: Edge[];
  /** Wider content for the admin website. */
  wide?: boolean;
  /** Turns on pull to refresh. */
  onRefresh?: () => Promise<void>;
};

/** Scrolling page with the standard background, padding and maximum width. */
export function Screen({ children, footer, edges = ['top', 'left', 'right'], wide = false, onRefresh }: ScreenProps) {
  const theme = useTheme();
  const maxWidth = wide ? 1100 : MaxContentWidth;
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    setRefreshing(true);
    await onRefresh?.();
    setRefreshing(false);
  }

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]} edges={edges}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        refreshControl={
          onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.primary} /> : undefined
        }>
        <View style={[styles.content, { maxWidth }]}>{children}</View>
      </ScrollView>
      {footer && (
        <SafeAreaView edges={['bottom']} style={{ backgroundColor: theme.surface, borderTopColor: theme.border }}>
          <View style={[styles.footer, { maxWidth }]}>{footer}</View>
        </SafeAreaView>
      )}
    </SafeAreaView>
  );
}

/** Full-screen spinner while a page loads. */
export function LoadingScreen() {
  const theme = useTheme();
  return (
    <View style={[styles.flex, styles.center, { backgroundColor: theme.background }]}>
      <ActivityIndicator color={theme.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flexGrow: 1,
    paddingBottom: Spacing.five,
  },
  content: {
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    gap: Spacing.four,
  },
  footer: {
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    gap: Spacing.two,
  },
});

import { DMSans_400Regular } from '@expo-google-fonts/dm-sans/400Regular';
import { DMSans_500Medium } from '@expo-google-fonts/dm-sans/500Medium';
import { DMSans_700Bold } from '@expo-google-fonts/dm-sans/700Bold';
import { SpaceGrotesk_500Medium } from '@expo-google-fonts/space-grotesk/500Medium';
import { SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk/700Bold';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { ComingSoon, HOLDING_PAGE, HOLDING_PAGE_EXCEPTIONS } from '@/components/coming-soon';
import { NoIndex } from '@/components/page-meta';
import { LoadingScreen } from '@/components/screen';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider, useAuth } from '@/lib/auth';

SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 300, fade: true });

export default function RootLayout() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[scheme];
  const [fontsLoaded, fontError] = useFonts({
    SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
  });

  if (!fontsLoaded && !fontError) return null;

  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
    },
  };

  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      {HOLDING_PAGE ? (
        <HoldingPage />
      ) : (
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      )}
    </ThemeProvider>
  );
}


function HoldingPage() {
  const pathname = usePathname();
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);
  if (HOLDING_PAGE_EXCEPTIONS.has(pathname)) return <Stack screenOptions={{ headerShown: false }} />;
  return <ComingSoon />;
}

/** Website pages for everyone, shown without waiting for the sign-in check (see RootNavigator). */
const PUBLIC_WEB_PAGES = new Set(['/', '/welcome', '/privacy', '/terms', '/support']);

/**
 * Who sees what:
 *   website, signed out or customer -> (site): home "/", post a job, my jobs
 *   signed out                      -> (auth): trade welcome, sign in, sign up (on phones "/"
 *                                      falls through to the welcome screen)
 *   trade                           -> (trade): application, then their home
 *   anyone else signed in           -> (other): admins go to /admin; customers on the phone
 *                                      app are pointed to the website
 *   /admin                          -> founders' website, with its own sign-in (admin/_layout)
 *   /membership                     -> website only: trades start and manage their Stripe membership
 *   /privacy, /terms, /support      -> everyone; in the app they open with a back button
 */
function RootNavigator() {
  const { session, role, loading } = useAuth();
  const colors = Colors[useColorScheme() === 'dark' ? 'dark' : 'light'];
  const pathname = usePathname();

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync();
  }, [loading]);

  const isWeb = Platform.OS === 'web';
  const isPublicPage = isWeb && PUBLIC_WEB_PAGES.has(pathname);
  // Every other page (sign-in, admin, a customer's or trade's own pages) stays out of search results.
  const noIndex = isWeb && !isPublicPage && <NoIndex />;

  // The website's public pages are drawn straight away as for a signed-out visitor, rather than
  // waiting for the sign-in check. The website is built by drawing each page ahead of time,
  // where there's no sign-in to check, so this puts the real page (not a spinner) in the HTML
  // that search engines read, and the browser's first draw matches it. A signed-in trade is
  // moved to their own pages a moment later, once the check finishes.
  if (loading && !isPublicPage) {
    return (
      <>
        {noIndex}
        <LoadingScreen />
      </>
    );
  }

  const isTrade = !!session && role === 'trade';
  const onCustomerSite = isWeb && (!session || role === 'customer');

  return (
    <>
      {noIndex}
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        {/*
          The customer website comes first. Several groups have a page at "/", and the hosted
          website can open the wrong one (e.g. the trade home); a visitor who can't see it is sent
          to the first group they can. On the web that must be the customer site, not the trade
          welcome page. Phones never show (site), so they still fall through to (auth).
        */}
        <Stack.Protected guard={onCustomerSite}>
          <Stack.Screen name="(site)" />
        </Stack.Protected>
        <Stack.Protected guard={!session}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Protected guard={isTrade}>
          <Stack.Screen name="(trade)" />
        </Stack.Protected>
        <Stack.Protected guard={!!session && !isTrade && !onCustomerSite}>
          <Stack.Screen name="(other)" />
        </Stack.Protected>
        <Stack.Screen name="admin" />
        <Stack.Screen name="membership" options={{ title: 'Membership · Backed.' }} />
        <Stack.Screen name="privacy" options={{ title: 'Privacy policy', headerShown: !isWeb }} />
        <Stack.Screen name="terms" options={{ title: 'Terms', headerShown: !isWeb }} />
        <Stack.Screen name="support" options={{ title: 'Help', headerShown: !isWeb }} />
        <Stack.Screen name="style-guide" />
      </Stack>
    </>
  );
}

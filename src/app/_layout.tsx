import { DMSans_400Regular } from '@expo-google-fonts/dm-sans/400Regular';
import { DMSans_500Medium } from '@expo-google-fonts/dm-sans/500Medium';
import { DMSans_700Bold } from '@expo-google-fonts/dm-sans/700Bold';
import { SpaceGrotesk_500Medium } from '@expo-google-fonts/space-grotesk/500Medium';
import { SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk/700Bold';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { ComingSoon } from '@/components/coming-soon';
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

/**
 * Before launch, backedtrades.co.uk shows a "coming soon" page on every address. It's the same
 * website exported with the switch on:
 *   EXPO_PUBLIC_HOLDING_PAGE=1 npx expo export --platform web --output-dir dist-holding --clear
 * Always export with --clear when switching between the two: the build cache doesn't notice the
 * setting change, and a real-site build once came out showing "coming soon".
 */
const HOLDING_PAGE = Platform.OS === 'web' && process.env.EXPO_PUBLIC_HOLDING_PAGE === '1';

function HoldingPage() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);
  return <ComingSoon />;
}

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
 */
function RootNavigator() {
  const { session, role, loading } = useAuth();
  const colors = Colors[useColorScheme() === 'dark' ? 'dark' : 'light'];

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync();
  }, [loading]);

  if (loading) return <LoadingScreen />;

  const isWeb = Platform.OS === 'web';
  const isTrade = !!session && role === 'trade';
  const onCustomerSite = isWeb && (!session || role === 'customer');

  return (
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
      <Stack.Screen name="style-guide" />
    </Stack>
  );
}

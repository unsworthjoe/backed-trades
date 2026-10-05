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
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </ThemeProvider>
  );
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
      <Stack.Protected guard={!session}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={onCustomerSite}>
        <Stack.Screen name="(site)" />
      </Stack.Protected>
      <Stack.Protected guard={isTrade}>
        <Stack.Screen name="(trade)" />
      </Stack.Protected>
      <Stack.Protected guard={!!session && !isTrade && !onCustomerSite}>
        <Stack.Screen name="(other)" />
      </Stack.Protected>
      <Stack.Screen name="admin" />
      <Stack.Screen name="style-guide" />
    </Stack>
  );
}

/**
 * Backed. design tokens.
 *
 * The brand colour is set once in `Brand` below. To try another colour, change the values there;
 * everything else (buttons, links, queue position, tab highlights) picks it up.
 */

import { Platform } from 'react-native';

/** Brand colour for now (electric purple). Expected to change after the founders' next meeting. */
const Brand = {
  /** Main brand fill: buttons, the logo dot, highlights. */
  light: '#8A3FFC',
  /** Brighter version that reads well on dark backgrounds. */
  dark: '#A877FF',
  /** Darker version for brand-coloured text on white (passes contrast at body sizes). */
  textOnLight: '#7432E0',
  /** Lighter version for brand-coloured text on dark backgrounds. */
  textOnDark: '#C4A5FF',
  /** Pale background for chips and highlights. */
  tintLight: '#EFE6FF',
  tintDark: '#2A1F45',
  /** Text and icons placed on top of the brand fill. */
  onBrandLight: '#FFFFFF',
  onBrandDark: '#16181C',
} as const;

export const Colors = {
  light: {
    text: '#16181C',
    textSecondary: '#5B616B',
    background: '#F2F3F5',
    surface: '#FFFFFF',
    surfaceRaised: '#FFFFFF',
    surfaceInverse: '#16181C',
    textOnInverse: '#F2F3F5',
    textSecondaryOnInverse: '#A3A9B3',
    primaryOnInverse: Brand.dark,
    trackOnInverse: '#343842',
    border: '#DADDE2',
    primary: Brand.light,
    onPrimary: Brand.onBrandLight,
    primaryText: Brand.textOnLight,
    primaryTint: Brand.tintLight,
    success: '#18794A',
    successTint: '#E3F4EA',
    warning: '#A15C00',
    warningTint: '#FFF1DB',
    danger: '#C62828',
    dangerTint: '#FDE7E7',
    info: '#2F6FDB',
    infoTint: '#E5EEFC',
  },
  dark: {
    text: '#F2F3F5',
    textSecondary: '#A3A9B3',
    background: '#121418',
    surface: '#1D2026',
    surfaceRaised: '#262A31',
    surfaceInverse: '#F2F3F5',
    textOnInverse: '#16181C',
    textSecondaryOnInverse: '#5B616B',
    primaryOnInverse: Brand.light,
    trackOnInverse: '#DADDE2',
    border: '#343842',
    primary: Brand.dark,
    onPrimary: Brand.onBrandDark,
    primaryText: Brand.textOnDark,
    primaryTint: Brand.tintDark,
    success: '#3FC17A',
    successTint: '#16301F',
    warning: '#F0B65A',
    warningTint: '#33270F',
    danger: '#FF6B6B',
    dangerTint: '#3A1717',
    info: '#7AA7FF',
    infoTint: '#18243A',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/** Loaded in `src/app/_layout.tsx`. Use the family name directly; don't also set fontWeight. */
export const Fonts = {
  display: 'SpaceGrotesk_700Bold',
  displayMedium: 'SpaceGrotesk_500Medium',
  body: 'DMSans_400Regular',
  bodyMedium: 'DMSans_500Medium',
  bodyBold: 'DMSans_700Bold',
  mono: Platform.select({ ios: 'ui-monospace', web: 'ui-monospace, monospace', default: 'monospace' }),
} as const;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  small: 8,
  medium: 14,
  large: 20,
  pill: 999,
} as const;

/** Minimum height for anything tappable. */
export const TouchTarget = 48;

export const MaxContentWidth = 800;

/** In the browser, the session goes in the browser's own localStorage (expo-sqlite isn't needed). */
export const sessionStorage = typeof window === 'undefined' ? undefined : window.localStorage;

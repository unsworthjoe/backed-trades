import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/database';

type Profile = Tables<'profiles'>;
type Role = Profile['role'];

type AuthState = {
  session: Session | null;
  profile: Profile | null;
  /**
   * Known straight away for customers (they sign in with a phone number only), so signing in
   * mid-way through posting a job doesn't reload the page. Trades and admins (email) wait for
   * their profile.
   */
  role: Role | null;
  /** True until the stored session (and, for email accounts, the profile) has loaded. */
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  // Remembers whose profile was loaded, so a new sign-in shows as loading until it arrives.
  const [loadedProfile, setLoadedProfile] = useState<{ userId: string; profile: Profile | null } | null>(null);
  const userId = session?.user.id;
  const profileLoaded = !userId || loadedProfile?.userId === userId;
  const profile = userId && loadedProfile?.userId === userId ? loadedProfile.profile : null;
  const isPhoneOnly = !!session && !session.user.email;
  const role: Role | null = profile?.role ?? (isPhoneOnly ? 'customer' : null);
  const loading = !sessionLoaded || (!isPhoneOnly && !profileLoaded);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionLoaded(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  // Loaded separately from the auth callback: Supabase advises against
  // awaiting other calls inside onAuthStateChange.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setLoadedProfile({ userId, profile: data });
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return (
    <AuthContext.Provider value={{ session, profile, role, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}

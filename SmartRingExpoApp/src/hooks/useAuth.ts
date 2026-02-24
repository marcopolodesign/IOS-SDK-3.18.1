import { useState, useEffect, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../services/SupabaseService';
import {
  signInWithEmail,
  signUpWithEmail,
  signOut as authSignOut,
  signInWithGitHub as authSignInWithGitHub,
  resetPassword as authResetPassword,
  updateProfile as authUpdateProfile,
  getProfile,
} from '../services/AuthService';
import { Profile } from '../types/supabase.types';

export interface AuthState {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

/**
 * useAuth hook following official Supabase React Native pattern
 * @see https://supabase.com/docs/guides/getting-started/tutorials/with-expo-react-native
 */
export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      // console.log('[useAuth] Initial session:', !!session);
      // console.log('[useAuth] User in session:', session?.user);
      setSession(session);
      setIsLoading(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('[useAuth] Auth state changed:', _event, !!session);
      setSession(session);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Load profile when session changes (non-blocking)
  useEffect(() => {
    if (session?.user) {
      getProfile(session.user.id).then(setProfile);
    } else {
      setProfile(null);
    }
  }, [session?.user?.id]);

  const signIn = useCallback(async (email: string, password: string) => {
    console.log('[useAuth] signIn called');
    const result = await signInWithEmail(email, password);
    console.log('[useAuth] signIn result:', result.success);
    return result;
  }, []);

  const signUp = useCallback(async (email: string, password: string, displayName?: string) => {
    console.log('[useAuth] signUp called');
    const result = await signUpWithEmail(email, password, displayName);
    console.log('[useAuth] signUp result:', result.success);
    return result;
  }, []);

  const signOut = useCallback(async () => {
    console.log('[useAuth] signOut called');
    const result = await authSignOut();
    return result;
  }, []);

  const signInWithGitHub = useCallback(async () => {
    console.log('[useAuth] signInWithGitHub called');
    const result = await authSignInWithGitHub();
    return result;
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    return authResetPassword(email);
  }, []);

  const updateProfile = useCallback(async (updates: Partial<Profile>) => {
    if (!session?.user) {
      return { success: false, error: 'Not authenticated' };
    }
    const result = await authUpdateProfile(session.user.id, updates);
    if (result.success) {
      // Reload profile
      const newProfile = await getProfile(session.user.id);
      setProfile(newProfile);
    }
    return result;
  }, [session?.user]);

  return {
    user: session?.user ?? null,
    session,
    profile,
    isLoading,
    isAuthenticated: !!session,
    signIn,
    signUp,
    signOut,
    signInWithGitHub,
    resetPassword,
    updateProfile,
  };
}

export default useAuth;

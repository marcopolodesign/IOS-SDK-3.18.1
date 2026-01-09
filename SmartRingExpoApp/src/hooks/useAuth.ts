import { useState, useEffect, useCallback } from 'react';
import { authService, AuthState } from '../services/AuthService';
import { Profile } from '../types/supabase.types';

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    profile: null,
    isLoading: true,
    isAuthenticated: false,
  });

  useEffect(() => {
    let mounted = true;

    // Initialize auth state
    const initAuth = async () => {
      // Small delay to ensure AuthService has initialized
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if (mounted) {
        const initialState = authService.getAuthState();
        setAuthState({ ...initialState, isLoading: false });
      }
    };

    initAuth();

    // Subscribe to auth state changes
    const unsubscribe = authService.onAuthStateChange((state) => {
      if (mounted) {
        setAuthState({ ...state, isLoading: false });
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const signUp = useCallback(async (email: string, password: string, displayName?: string) => {
    setAuthState(prev => ({ ...prev, isLoading: true }));
    const result = await authService.signUp(email, password, displayName);
    setAuthState(prev => ({ ...prev, isLoading: false }));
    return result;
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setAuthState(prev => ({ ...prev, isLoading: true }));
    const result = await authService.signIn(email, password);
    setAuthState(prev => ({ ...prev, isLoading: false }));
    return result;
  }, []);

  const signInWithGitHub = useCallback(async () => {
    setAuthState(prev => ({ ...prev, isLoading: true }));
    const result = await authService.signInWithGitHub();
    setAuthState(prev => ({ ...prev, isLoading: false }));
    return result;
  }, []);

  const signOut = useCallback(async () => {
    setAuthState(prev => ({ ...prev, isLoading: true }));
    const result = await authService.signOut();
    setAuthState(prev => ({ ...prev, isLoading: false }));
    return result;
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    return authService.resetPassword(email);
  }, []);

  const updateProfile = useCallback(async (updates: Partial<Profile>) => {
    return authService.updateProfile(updates);
  }, []);

  return {
    ...authState,
    signUp,
    signIn,
    signInWithGitHub,
    signOut,
    resetPassword,
    updateProfile,
  };
}

export default useAuth;


import { Session, User } from '@supabase/supabase-js';
import { supabase } from './SupabaseService';
import { Profile } from '../types/supabase.types';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';

// For OAuth redirect
WebBrowser.maybeCompleteAuthSession();

export interface AuthState {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export interface SignUpResult {
  success: boolean;
  user?: User;
  error?: string;
  needsEmailConfirmation?: boolean;
}

export interface SignInResult {
  success: boolean;
  user?: User;
  session?: Session;
  error?: string;
}

// ============================================
// Simple auth functions following Supabase docs
// ============================================

export async function signInWithEmail(email: string, password: string): Promise<SignInResult> {
  console.log('[Auth] signInWithEmail called');
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.log('[Auth] signIn error:', error.message);
    return { success: false, error: error.message };
  }

  console.log('[Auth] signIn success, session:', !!data.session);
  return {
    success: true,
    user: data.user,
    session: data.session,
  };
}

export async function signUpWithEmail(email: string, password: string, displayName?: string): Promise<SignUpResult> {
  console.log('[Auth] signUpWithEmail called');
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName },
    },
  });

  if (error) {
    console.log('[Auth] signUp error:', error.message);
    return { success: false, error: error.message };
  }

  // If no session, email confirmation is required
  if (data.user && !data.session) {
    console.log('[Auth] signUp needs email confirmation');
    return {
      success: true,
      user: data.user,
      needsEmailConfirmation: true,
    };
  }

  console.log('[Auth] signUp success');
  return { success: true, user: data.user ?? undefined };
}

export async function signOut(): Promise<{ success: boolean; error?: string }> {
  console.log('[Auth] signOut called');
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.log('[Auth] signOut error:', error.message);
    return { success: false, error: error.message };
  }

  console.log('[Auth] signOut success');
  return { success: true };
}

export async function resetPassword(email: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: 'smartring://auth/reset-password',
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function signInWithGitHub(): Promise<SignInResult> {
  try {
    const redirectUri = makeRedirectUri({
      scheme: 'com.smartring.testapp',
      path: 'auth/callback',
    });

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: redirectUri,
        skipBrowserRedirect: true,
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (data.url) {
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);

      if (result.type === 'success' && result.url) {
        const url = new URL(result.url);
        const accessToken = url.searchParams.get('access_token');
        const refreshToken = url.searchParams.get('refresh_token');

        if (accessToken && refreshToken) {
          const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (sessionError) {
            return { success: false, error: sessionError.message };
          }

          return {
            success: true,
            user: sessionData.user ?? undefined,
            session: sessionData.session ?? undefined,
          };
        }
      }

      return { success: false, error: 'OAuth flow was cancelled or failed' };
    }

    return { success: false, error: 'No OAuth URL returned' };
  } catch (e) {
    const error = e as Error;
    return { success: false, error: error.message };
  }
}

// ============================================
// Profile functions (separate from auth)
// ============================================

export async function getProfile(userId: string): Promise<Profile | null> {
  console.log('[Auth] getProfile for:', userId);
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.log('[Auth] getProfile error:', error.message);
    return null;
  }

  console.log('[Auth] getProfile success');
  return data;
}

export async function updateProfile(userId: string, updates: Partial<Profile>): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

// ============================================
// Legacy AuthService class for backwards compatibility
// ============================================

class AuthService {
  async signIn(email: string, password: string): Promise<SignInResult> {
    return signInWithEmail(email, password);
  }

  async signUp(email: string, password: string, displayName?: string): Promise<SignUpResult> {
    return signUpWithEmail(email, password, displayName);
  }

  async signOut(): Promise<{ success: boolean; error?: string }> {
    return signOut();
  }

  async signInWithGitHub(): Promise<SignInResult> {
    return signInWithGitHub();
  }

  async resetPassword(email: string): Promise<{ success: boolean; error?: string }> {
    return resetPassword(email);
  }

  async updateProfile(updates: Partial<Profile>): Promise<{ success: boolean; error?: string }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }
    return updateProfile(user.id, updates);
  }

  getAuthState(): AuthState {
    // This is now synchronous and may not have latest state
    // Use the hook instead
    return {
      user: null,
      session: null,
      profile: null,
      isLoading: false,
      isAuthenticated: false,
    };
  }

  onAuthStateChange(callback: (state: AuthState) => void): () => void {
    // Redirect to supabase.auth.onAuthStateChange
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      callback({
        user: session?.user ?? null,
        session: session,
        profile: null,
        isLoading: false,
        isAuthenticated: !!session,
      });
    });
    return () => subscription.unsubscribe();
  }
}

export const authService = new AuthService();
export default authService;

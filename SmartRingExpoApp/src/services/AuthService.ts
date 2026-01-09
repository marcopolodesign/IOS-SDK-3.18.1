import { Session, User, AuthError } from '@supabase/supabase-js';
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

class AuthService {
  private _currentUser: User | null = null;
  private _currentSession: Session | null = null;
  private _currentProfile: Profile | null = null;
  private _authStateListeners: ((state: AuthState) => void)[] = [];

  constructor() {
    this.initializeAuth();
  }

  private async initializeAuth() {
    // Listen to auth state changes
    supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event);
      this._currentSession = session;
      this._currentUser = session?.user ?? null;

      if (session?.user) {
        await this.loadProfile(session.user.id);
      } else {
        this._currentProfile = null;
      }

      this.notifyListeners();
    });

    // Get initial session
    const { data: { session } } = await supabase.auth.getSession();
    this._currentSession = session;
    this._currentUser = session?.user ?? null;

    if (session?.user) {
      await this.loadProfile(session.user.id);
    }
  }

  private async loadProfile(userId: string) {
    console.log('[AuthService] Loading profile for user:', userId);
    
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error && error.code === 'PGRST116') {
      // Profile doesn't exist - create it
      console.log('[AuthService] Profile not found, creating one...');
      const { data: newProfile, error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          email: this._currentUser?.email,
        })
        .select()
        .single();
      
      if (insertError) {
        console.error('[AuthService] Failed to create profile:', insertError);
      } else {
        console.log('[AuthService] Profile created successfully');
        this._currentProfile = newProfile;
      }
    } else if (error) {
      console.error('[AuthService] Error loading profile:', error);
      this._currentProfile = null;
    } else {
      console.log('[AuthService] Profile loaded');
      this._currentProfile = data;
    }
  }

  private notifyListeners() {
    const state = this.getAuthState();
    this._authStateListeners.forEach(listener => listener(state));
  }

  // ============================================
  // GETTERS
  // ============================================

  get currentUser(): User | null {
    return this._currentUser;
  }

  get currentSession(): Session | null {
    return this._currentSession;
  }

  get currentProfile(): Profile | null {
    return this._currentProfile;
  }

  get isAuthenticated(): boolean {
    return !!this._currentSession;
  }

  getAuthState(): AuthState {
    return {
      user: this._currentUser,
      session: this._currentSession,
      profile: this._currentProfile,
      isLoading: false,
      isAuthenticated: !!this._currentSession,
    };
  }

  // ============================================
  // LISTENERS
  // ============================================

  onAuthStateChange(callback: (state: AuthState) => void): () => void {
    this._authStateListeners.push(callback);
    // Return unsubscribe function
    return () => {
      this._authStateListeners = this._authStateListeners.filter(l => l !== callback);
    };
  }

  // ============================================
  // EMAIL AUTH
  // ============================================

  async signUp(email: string, password: string, displayName?: string): Promise<SignUpResult> {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName,
          },
        },
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data.user && !data.session) {
        // Email confirmation required
        return {
          success: true,
          user: data.user,
          needsEmailConfirmation: true,
        };
      }

      return { success: true, user: data.user ?? undefined };
    } catch (e) {
      const error = e as Error;
      return { success: false, error: error.message };
    }
  }

  async signIn(email: string, password: string): Promise<SignInResult> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return {
        success: true,
        user: data.user,
        session: data.session,
      };
    } catch (e) {
      const error = e as Error;
      return { success: false, error: error.message };
    }
  }

  // ============================================
  // OAUTH (GitHub)
  // ============================================

  async signInWithGitHub(): Promise<SignInResult> {
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
        // Open browser for OAuth
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          redirectUri
        );

        if (result.type === 'success' && result.url) {
          // Extract the session from the URL
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
  // SESSION MANAGEMENT
  // ============================================

  async signOut(): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        return { success: false, error: error.message };
      }

      this._currentUser = null;
      this._currentSession = null;
      this._currentProfile = null;

      return { success: true };
    } catch (e) {
      const error = e as Error;
      return { success: false, error: error.message };
    }
  }

  async refreshSession(): Promise<boolean> {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error || !data.session) {
        return false;
      }

      this._currentSession = data.session;
      this._currentUser = data.user;
      return true;
    } catch {
      return false;
    }
  }

  // ============================================
  // PASSWORD MANAGEMENT
  // ============================================

  async resetPassword(email: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'smartring://auth/reset-password',
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (e) {
      const error = e as Error;
      return { success: false, error: error.message };
    }
  }

  async updatePassword(newPassword: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (e) {
      const error = e as Error;
      return { success: false, error: error.message };
    }
  }

  // ============================================
  // PROFILE MANAGEMENT
  // ============================================

  async updateProfile(updates: Partial<Profile>): Promise<{ success: boolean; error?: string }> {
    if (!this._currentUser) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', this._currentUser.id);

      if (error) {
        return { success: false, error: error.message };
      }

      // Reload profile
      await this.loadProfile(this._currentUser.id);
      this.notifyListeners();

      return { success: true };
    } catch (e) {
      const error = e as Error;
      return { success: false, error: error.message };
    }
  }

  // ============================================
  // ACCOUNT DELETION
  // ============================================

  async deleteAccount(): Promise<{ success: boolean; error?: string }> {
    if (!this._currentUser) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      // Note: This requires a server-side function in production
      // For now, we'll just sign out
      // In production, you'd call a Supabase Edge Function to delete the user
      await this.signOut();
      return { success: true };
    } catch (e) {
      const error = e as Error;
      return { success: false, error: error.message };
    }
  }
}

export const authService = new AuthService();
export default authService;


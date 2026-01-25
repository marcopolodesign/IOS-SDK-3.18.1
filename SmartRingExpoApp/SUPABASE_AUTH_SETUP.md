# Supabase Authentication Setup

This document explains how authentication is configured in the Smart Ring app using Supabase Auth.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         React Native App                         │
├─────────────────────────────────────────────────────────────────┤
│  useAuth Hook (src/hooks/useAuth.ts)                            │
│    - Manages auth state for React components                     │
│    - Provides signIn, signUp, signOut methods                    │
│    - Subscribes to AuthService state changes                     │
├─────────────────────────────────────────────────────────────────┤
│  AuthService (src/services/AuthService.ts)                       │
│    - Wraps Supabase Auth SDK                                     │
│    - Manages user, session, and profile state                    │
│    - Notifies listeners on auth state changes                    │
├─────────────────────────────────────────────────────────────────┤
│  SupabaseService (src/services/SupabaseService.ts)               │
│    - Initializes Supabase client with AsyncStorage               │
│    - Provides database operations                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Supabase Backend                            │
├─────────────────────────────────────────────────────────────────┤
│  auth.users (Supabase managed)                                   │
│    - Stores user credentials                                     │
│    - Manages sessions and JWTs                                   │
├─────────────────────────────────────────────────────────────────┤
│  public.profiles (Custom table)                                  │
│    - Extends auth.users with app-specific data                   │
│    - Foreign key reference to auth.users(id)                     │
│    - Protected by Row Level Security (RLS)                       │
└─────────────────────────────────────────────────────────────────┘
```

## Supabase Client Configuration

The Supabase client is configured in `src/services/SupabaseService.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,        // Persist sessions in AsyncStorage
    autoRefreshToken: true,       // Automatically refresh expired tokens
    persistSession: true,         // Keep user logged in across app restarts
    detectSessionInUrl: false,    // Disabled for mobile apps
  },
});
```

### Key Configuration Options

| Option | Value | Purpose |
|--------|-------|---------|
| `storage` | `AsyncStorage` | Persists auth tokens on device |
| `autoRefreshToken` | `true` | Refreshes JWT before expiry |
| `persistSession` | `true` | Maintains login across app restarts |
| `detectSessionInUrl` | `false` | Disabled for React Native (no URL-based auth) |

## Environment Variables

Create a `.env` file with your Supabase credentials:

```bash
# .env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

- **SUPABASE_URL**: Your project's API URL (found in Supabase Dashboard > Settings > API)
- **SUPABASE_ANON_KEY**: The anonymous/public key (safe to include in client code)

## Database Schema

### Profiles Table

The `profiles` table extends `auth.users` with app-specific user data:

```sql
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE,
    display_name TEXT,
    avatar_url TEXT,
    height_cm INT,
    weight_kg FLOAT,
    birth_date DATE,
    gender TEXT CHECK (gender IN ('male', 'female', 'other')),
    strava_athlete_id BIGINT,
    ring_mac_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Auto-Create Profile Trigger

A database trigger automatically creates a profile when a user signs up:

```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email)
    VALUES (NEW.id, NEW.email);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

## Row Level Security (RLS)

RLS ensures users can only access their own data. The `auth.uid()` function returns the authenticated user's ID from their JWT.

### Optimized RLS Policies

**Important**: Wrap `auth.uid()` in a SELECT for better performance (prevents query hanging):

```sql
-- Enable RLS on profiles table
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can view their own profile
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING ((select auth.uid()) = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING ((select auth.uid()) = id);

-- Users can insert their own profile (fallback if trigger fails)
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK ((select auth.uid()) = id);
```

### Why `(select auth.uid())` Instead of `auth.uid()`?

From the [Supabase RLS documentation](https://supabase.com/docs/guides/database/postgres/row-level-security):

> Wrap functions in SELECT statements to cache results per statement. This can yield dramatic performance improvements.

The `(select auth.uid())` pattern:
- Caches the user ID for the entire query
- Prevents repeated function calls per row
- Avoids potential query hanging issues

### Common RLS Issues

1. **Query hangs indefinitely**: Usually caused by missing or misconfigured RLS policies
2. **Empty results**: `auth.uid()` returns `null` when unauthenticated
3. **Performance issues**: Add indexes on columns used in RLS policies

## Authentication Flow

### Sign In Flow

```
1. User enters email/password
2. AuthScreen calls useAuth().signIn()
3. signIn calls supabase.auth.signInWithPassword()
4. Supabase validates credentials, returns session + user
5. onAuthStateChange fires with SIGNED_IN event
6. useAuth hook updates session state
7. isAuthenticated becomes true
8. App navigates to home screen
9. Profile loads asynchronously (non-blocking)
```

### Session Persistence

Sessions are automatically persisted to AsyncStorage:

```
App Launch
    │
    ▼
supabase.auth.getSession()
    │
    ├─► Session exists → User is logged in
    │                    → Load profile
    │
    └─► No session → Show login screen
```

## Code Structure

### AuthService (src/services/AuthService.ts)

Simple functions that wrap Supabase auth methods:

```typescript
export async function signInWithEmail(email: string, password: string): Promise<SignInResult> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, user: data.user, session: data.session };
}

export async function signOut(): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.auth.signOut();
  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}
```

### useAuth Hook (src/hooks/useAuth.ts)

Following the official Supabase React Native pattern:

```typescript
export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsLoading(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return {
    user: session?.user ?? null,
    session,
    isLoading,
    isAuthenticated: !!session,
    signIn,
    signUp,
    signOut,
  };
}
```

**Key Points:**
- Use `supabase.auth.getSession()` to get initial session on mount
- Use `supabase.auth.onAuthStateChange()` to listen for changes
- Auth state is managed by Supabase SDK, not custom state management
- Profile loading is separate and non-blocking

## Troubleshooting

### Login Button Freezes

**Symptoms**: Clicking login shows spinner that never stops

**Causes**:
1. Profile query hanging due to RLS policy issues
2. Missing `(select auth.uid())` optimization
3. Network timeout to Supabase

**Solutions**:
1. Update RLS policies to use `(select auth.uid())` pattern
2. Add timeout to profile queries
3. Check Supabase Dashboard for errors

### "Invalid login credentials" Error

**Causes**:
1. Wrong email/password
2. User doesn't exist
3. Email not confirmed (if email confirmation is enabled)

**Solutions**:
1. Check credentials
2. Try signing up first
3. Check Supabase Dashboard > Auth > Users

### Profile Not Created on Sign Up

**Causes**:
1. `handle_new_user` trigger not created
2. Trigger function has errors
3. RLS blocking the insert

**Solutions**:
1. Run the trigger creation SQL in Supabase SQL Editor
2. Check Supabase logs for trigger errors
3. Add INSERT policy on profiles table

## Useful SQL Queries

Run these in the Supabase SQL Editor to debug issues:

```sql
-- Check if a user has a profile
SELECT * FROM profiles WHERE id = 'user-uuid-here';

-- Check RLS policies on profiles
SELECT * FROM pg_policies WHERE tablename = 'profiles';

-- Check if trigger exists
SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';

-- Manually create profile for existing user
INSERT INTO profiles (id, email)
VALUES ('user-uuid-here', 'user@email.com')
ON CONFLICT (id) DO NOTHING;

-- Update RLS policies with optimized pattern
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING ((select auth.uid()) = id);
```

## References

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Row Level Security Guide](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [React Native Quickstart](https://supabase.com/docs/guides/auth/quickstarts/react-native)

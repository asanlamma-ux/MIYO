import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { logger, captureError } from '@/utils/logger';
import type { Session, User } from '@supabase/supabase-js';
import {
  clearGoogleProviderTokens,
  getAuthRedirectBaseUrl,
  persistGoogleProviderTokens,
  type OAuthActionResult,
  startGoogleOAuth,
} from '@/lib/google-oauth';
import { isGoogleSignInDisabled } from '@/utils/beta-flags';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<OAuthActionResult>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function looksLikeEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function AuthProvider({ children }: { children: ReactNode }) {
      const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Restore existing session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      setIsLoading(false);
      if (s) logger.info('Auth session restored');
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, s) => {
        setSession(s);
        setUser(s?.user ?? null);
        void persistGoogleProviderTokens(s);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string) => {
    if (!isSupabaseConfigured) {
      return {
        error: 'Supabase env is missing. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY first.',
      };
    }
    const normalizedEmail = normalizeEmail(email);
    if (!looksLikeEmail(normalizedEmail)) {
      return { error: 'Enter a valid email address.' };
    }
    if (password.length < 8) {
      return { error: 'Use at least 8 characters for your password.' };
    }
    try {
      const { error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: getAuthRedirectBaseUrl(),
        },
      });
      if (error) {
        logger.error('Sign-up failed', error);
        return { error: error.message };
      }
      logger.info('Sign-up succeeded');
      return { error: null };
    } catch (e) {
      captureError('Sign Up', e);
      return { error: 'An unexpected error occurred.' };
    }
  };

  const signIn = async (email: string, password: string) => {
    if (!isSupabaseConfigured) {
      return {
        error: 'Supabase env is missing. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY first.',
      };
    }
    const normalizedEmail = normalizeEmail(email);
    if (!looksLikeEmail(normalizedEmail)) {
      return { error: 'Enter a valid email address.' };
    }
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
      if (error) {
        logger.error('Sign-in failed', error);
        return { error: error.message };
      }
      logger.info('Sign-in succeeded');
      return { error: null };
    } catch (e) {
      captureError('Sign In', e);
      return { error: 'An unexpected error occurred.' };
    }
  };

  const signInWithGoogle = async (): Promise<OAuthActionResult> => {
    if (isGoogleSignInDisabled()) {
      return {
        error: 'Google sign-in is disabled in this beta build.',
        success: false,
        status: 'error',
      };
    }
    if (!isSupabaseConfigured) {
      return {
        error: 'Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY, then enable Google in Supabase Auth > Providers.',
        success: false,
        status: 'misconfigured',
      };
    }
    try {
      return await startGoogleOAuth();
    } catch (e) {
      captureError('Google Sign In', e);
      return { error: 'Google sign-in failed.', success: false, status: 'error' };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      await clearGoogleProviderTokens();
      logger.info('Signed out');
    } catch (e) {
      captureError('Sign Out', e);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isAuthenticated: !!session,
        isLoading,
        signUp,
        signIn,
        signInWithGoogle,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

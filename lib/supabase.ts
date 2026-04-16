import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const expoConstants = Constants as typeof Constants & {
  manifest2?: {
    extra?: Record<string, string | undefined>;
  };
};
const expoExtra = (expoConstants.expoConfig?.extra || expoConstants.manifest2?.extra || {}) as Record<
  string,
  string | undefined
>;
const FALLBACK_SUPABASE_URL = 'https://fonhjguymlijbswhmedx.supabase.co';
const FALLBACK_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvbmhqZ3V5bWxpamJzd2htZWR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NDk0NjUsImV4cCI6MjA5MTIyNTQ2NX0.0aGHrFUbviQ3-hSZKK4kpnBSYXrFjFB7l76QE8FBHuc';

const configuredUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || expoExtra.supabaseUrl || FALLBACK_SUPABASE_URL;
const configuredAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || expoExtra.supabaseAnonKey || FALLBACK_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(configuredUrl && configuredAnonKey);
export const supabaseUrl = configuredUrl;
export const supabaseAnonKey = configuredAnonKey;

const memoryStorage = new Map<string, string>();

function shouldUseMemoryStorage() {
  return Platform.OS === 'web' && typeof window === 'undefined';
}

const ExpoSafeStorage = {
  getItem: (key: string) =>
    shouldUseMemoryStorage()
      ? Promise.resolve(memoryStorage.get(key) ?? null)
      : AsyncStorage.getItem(key),
  setItem: (key: string, value: string) =>
    shouldUseMemoryStorage()
      ? Promise.resolve(void memoryStorage.set(key, value))
      : AsyncStorage.setItem(key, value),
  removeItem: (key: string) =>
    shouldUseMemoryStorage()
      ? Promise.resolve(void memoryStorage.delete(key))
      : AsyncStorage.removeItem(key),
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSafeStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});

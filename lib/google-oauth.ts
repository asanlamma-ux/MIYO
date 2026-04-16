import { AuthRequest, exchangeCodeAsync, makeRedirectUri, refreshAsync, ResponseType, revokeAsync, type TokenResponse } from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import type { EmailOtpType, Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { captureError, logger } from '@/utils/logger';
import { isCloudSyncDisabled, isGoogleSignInDisabled } from '@/utils/beta-flags';

export type OAuthActionStatus = 'success' | 'cancelled' | 'misconfigured' | 'error' | 'verified_without_session';

export interface OAuthActionResult {
  success: boolean;
  status: OAuthActionStatus;
  error: string | null;
  session?: Session | null;
  requiresManualSignIn?: boolean;
}

export interface DriveTokenState {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: number | null;
  scope?: string | null;
  tokenType?: string | null;
}

export const GOOGLE_PROVIDER_TOKEN_KEY = '@miyo/google/provider_token';
export const GOOGLE_PROVIDER_REFRESH_TOKEN_KEY = '@miyo/google/provider_refresh_token';
const GOOGLE_DRIVE_TOKENS_KEY = '@miyo/google-drive/tokens';

const GOOGLE_DISCOVERY = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

WebBrowser.maybeCompleteAuthSession();

export function getAuthRedirectUrl(path = 'auth/confirm') {
  return makeRedirectUri({ scheme: 'miyo', path });
}

export function getAuthRedirectBaseUrl() {
  const base = makeRedirectUri({ scheme: 'miyo' });
  return base.endsWith('/') ? base : `${base}/`;
}

export function getDriveRedirectUrl() {
  return getAuthRedirectUrl('auth/drive');
}

export function getGoogleDriveClientId(): string {
  if (Platform.OS === 'android') {
    return process.env.EXPO_PUBLIC_GOOGLE_DRIVE_ANDROID_CLIENT_ID || process.env.EXPO_PUBLIC_GOOGLE_DRIVE_CLIENT_ID || '';
  }
  if (Platform.OS === 'ios') {
    return process.env.EXPO_PUBLIC_GOOGLE_DRIVE_IOS_CLIENT_ID || process.env.EXPO_PUBLIC_GOOGLE_DRIVE_CLIENT_ID || '';
  }
  return process.env.EXPO_PUBLIC_GOOGLE_DRIVE_WEB_CLIENT_ID || process.env.EXPO_PUBLIC_GOOGLE_DRIVE_CLIENT_ID || '';
}

export function isGoogleDriveClientConfigured(): boolean {
  return !isCloudSyncDisabled() && !!getGoogleDriveClientId();
}

function isProviderMisconfigured(message: string | null | undefined): boolean {
  const normalized = (message || '').toLowerCase();
  return normalized.includes('missing oauth secret') || normalized.includes('unsupported provider') || normalized.includes('validation_failed');
}

function normalizeOAuthError(message: string | null | undefined, fallback: string): string {
  if (!message) return fallback;
  if (isProviderMisconfigured(message)) {
    return 'Google auth is not configured correctly in Supabase yet. Add the Google OAuth client ID and secret in Supabase Auth > Providers, then try again.';
  }
  return message;
}

function toSuccess(session?: Session | null): OAuthActionResult {
  return { success: true, status: 'success', error: null, session: session || null };
}

export function parseUrlParams(url: string): Record<string, string> {
  const hash = url.includes('#') ? url.split('#')[1] : '';
  const query = url.includes('?') ? url.split('?')[1] : '';
  const segment = hash || query;
  if (!segment) return {};
  const params = new URLSearchParams(segment);
  const out: Record<string, string> = {};
  params.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

function getSessionRedirectError(url: string): OAuthActionResult | null {
  const params = parseUrlParams(url);
  const redirectError = params.error_description || params.error || params.error_code;
  if (!redirectError) return null;
  return {
    success: false,
    status: isProviderMisconfigured(redirectError) ? 'misconfigured' : 'error',
    error: normalizeOAuthError(redirectError, 'Authentication failed.'),
  };
}

export async function persistGoogleProviderTokens(session: Session | null) {
  const providerToken = session?.provider_token;
  const providerRefreshToken = session?.provider_refresh_token;

  if (providerToken) {
    await SecureStore.setItemAsync(GOOGLE_PROVIDER_TOKEN_KEY, providerToken);
  }
  if (providerRefreshToken) {
    await SecureStore.setItemAsync(GOOGLE_PROVIDER_REFRESH_TOKEN_KEY, providerRefreshToken);
  }
  if (!providerToken && !providerRefreshToken) {
    await clearGoogleProviderTokens();
  }
}

export async function clearGoogleProviderTokens() {
  await SecureStore.deleteItemAsync(GOOGLE_PROVIDER_TOKEN_KEY);
  await SecureStore.deleteItemAsync(GOOGLE_PROVIDER_REFRESH_TOKEN_KEY);
}

export async function getGoogleProviderToken() {
  return SecureStore.getItemAsync(GOOGLE_PROVIDER_TOKEN_KEY);
}

export async function completeGoogleOAuthRedirect(url: string): Promise<OAuthActionResult> {
  try {
    const redirectError = getSessionRedirectError(url);
    if (redirectError) return redirectError;

    if (url.includes('code=')) {
      const { error } = await supabase.auth.exchangeCodeForSession(url);
      if (error) {
        return {
          success: false,
          status: isProviderMisconfigured(error.message) ? 'misconfigured' : 'error',
          error: normalizeOAuthError(error.message, 'Google sign-in failed.'),
        };
      }
      const { data } = await supabase.auth.getSession();
      await persistGoogleProviderTokens(data.session);
      return toSuccess(data.session);
    }

    const params = parseUrlParams(url);
    const accessToken = params.access_token;
    const refreshToken = params.refresh_token;
    if (accessToken && refreshToken) {
      const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      if (error) {
        return {
          success: false,
          status: 'error',
          error: normalizeOAuthError(error.message, 'Could not restore the Google session.'),
        };
      }
      const { data } = await supabase.auth.getSession();
      await persistGoogleProviderTokens(data.session);
      return toSuccess(data.session);
    }

    return {
      success: false,
      status: 'error',
      error: 'No session tokens were returned from Google.',
    };
  } catch (error) {
    captureError('Complete Google OAuth Redirect', error);
    return { success: false, status: 'error', error: 'Google sign-in failed.' };
  }
}

export async function startGoogleOAuth(options?: {
  scopes?: string[];
  forceConsent?: boolean;
}): Promise<OAuthActionResult> {
  if (isGoogleSignInDisabled()) {
    return {
      success: false,
      status: 'error',
      error: 'Google sign-in is disabled in this beta build.',
    };
  }
  if (!isSupabaseConfigured) {
    return {
      success: false,
      status: 'misconfigured',
      error: 'Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY, then enable Google in Supabase Auth > Providers.',
    };
  }

  try {
    const redirectTo = getAuthRedirectUrl();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        skipBrowserRedirect: true,
        scopes: options?.scopes?.join(' '),
        queryParams: {
          access_type: 'offline',
          prompt: options?.forceConsent ? 'consent' : 'select_account',
        },
      },
    });

    if (error || !data?.url) {
      return {
        success: false,
        status: error && isProviderMisconfigured(error.message) ? 'misconfigured' : 'error',
        error: normalizeOAuthError(error?.message, 'Could not start Google sign-in.'),
      };
    }

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== 'success' || !result.url) {
      return { success: false, status: 'cancelled', error: null };
    }

    return completeGoogleOAuthRedirect(result.url);
  } catch (error) {
    captureError('Start Google OAuth', error);
    return { success: false, status: 'error', error: 'Google sign-in failed.' };
  }
}

async function getStoredDriveTokens(): Promise<DriveTokenState | null> {
  const raw = await SecureStore.getItemAsync(GOOGLE_DRIVE_TOKENS_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DriveTokenState;
  } catch {
    await SecureStore.deleteItemAsync(GOOGLE_DRIVE_TOKENS_KEY);
    return null;
  }
}

async function persistDriveTokensFromResponse(response: TokenResponse, existing?: DriveTokenState | null): Promise<DriveTokenState> {
  const next: DriveTokenState = {
    accessToken: response.accessToken,
    refreshToken: response.refreshToken || existing?.refreshToken || null,
    expiresAt: response.expiresIn ? response.issuedAt + response.expiresIn : existing?.expiresAt || null,
    scope: response.scope || existing?.scope || null,
    tokenType: response.tokenType || existing?.tokenType || 'Bearer',
  };
  await SecureStore.setItemAsync(GOOGLE_DRIVE_TOKENS_KEY, JSON.stringify(next));
  return next;
}

export async function getDriveTokenState(): Promise<DriveTokenState | null> {
  return getStoredDriveTokens();
}

export async function clearDriveTokens() {
  await SecureStore.deleteItemAsync(GOOGLE_DRIVE_TOKENS_KEY);
}

export async function revokeDriveTokens() {
  const clientId = getGoogleDriveClientId();
  const tokens = await getStoredDriveTokens();
  try {
    if (clientId && tokens?.accessToken) {
      await revokeAsync({ clientId, token: tokens.accessToken }, GOOGLE_DISCOVERY);
    }
  } catch {
    // Best effort only.
  }
  await clearDriveTokens();
}

export async function startGoogleDriveOAuth(): Promise<OAuthActionResult> {
  if (isCloudSyncDisabled()) {
    return {
      success: false,
      status: 'error',
      error: 'Cloud sync is disabled in this beta build.',
    };
  }
  const clientId = getGoogleDriveClientId();
  if (!clientId) {
    return {
      success: false,
      status: 'misconfigured',
      error: 'Set EXPO_PUBLIC_GOOGLE_DRIVE_CLIENT_ID or the platform-specific Google Drive client ID before connecting Drive.',
    };
  }

  try {
    const redirectUri = getDriveRedirectUrl();
    const request = new AuthRequest({
      clientId,
      redirectUri,
      responseType: ResponseType.Code,
      usePKCE: true,
      scopes: [
        'openid',
        'email',
        'profile',
        'https://www.googleapis.com/auth/drive.file',
      ],
      extraParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    });

    const result = await request.promptAsync(GOOGLE_DISCOVERY);
    if (result.type === 'cancel' || result.type === 'dismiss' || result.type === 'opened' || result.type === 'locked') {
      return { success: false, status: 'cancelled', error: null };
    }

    if (result.type === 'error') {
      return {
        success: false,
        status: 'error',
        error: normalizeOAuthError(result.error?.message, 'Google Drive authentication failed.'),
      };
    }

    if (result.type !== 'success') {
      return { success: false, status: 'error', error: 'Google Drive authentication failed.' };
    }

    const oauthError = result.params.error_description || result.params.error;
    if (oauthError) {
      return {
        success: false,
        status: 'error',
        error: normalizeOAuthError(oauthError, 'Google Drive authentication failed.'),
      };
    }

    const code = result.params.code;
    if (!code || !request.codeVerifier) {
      return { success: false, status: 'error', error: 'Google Drive did not return a valid authorization code.' };
    }

    const tokenResponse = await exchangeCodeAsync(
      {
        clientId,
        code,
        redirectUri,
        extraParams: { code_verifier: request.codeVerifier },
      },
      GOOGLE_DISCOVERY
    );

    await persistDriveTokensFromResponse(tokenResponse, await getStoredDriveTokens());
    return { success: true, status: 'success', error: null };
  } catch (error) {
    captureError('Start Google Drive OAuth', error);
    return { success: false, status: 'error', error: 'Google Drive authentication failed.' };
  }
}

export async function getValidGoogleDriveAccessToken(): Promise<string | null> {
  const clientId = getGoogleDriveClientId();
  const stored = await getStoredDriveTokens();
  if (!stored) return null;

  const now = Math.floor(Date.now() / 1000);
  if (stored.accessToken && (!stored.expiresAt || stored.expiresAt - 60 > now)) {
    return stored.accessToken;
  }

  if (!stored.refreshToken || !clientId) {
    return null;
  }

  try {
    const refreshed = await refreshAsync(
      {
        clientId,
        refreshToken: stored.refreshToken,
      },
      GOOGLE_DISCOVERY
    );
    const next = await persistDriveTokensFromResponse(refreshed, stored);
    return next.accessToken;
  } catch (error) {
    captureError('Refresh Google Drive Token', error);
    await clearDriveTokens();
    return null;
  }
}

export async function verifyEmailLink(params: { token_hash?: string; type?: string; code?: string }): Promise<OAuthActionResult> {
  try {
    if (params.code) {
      const redirectUrl = `${getAuthRedirectUrl()}?code=${encodeURIComponent(params.code)}`;
      return completeGoogleOAuthRedirect(redirectUrl);
    }

    if (params.token_hash && params.type) {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: params.token_hash,
        type: params.type as EmailOtpType,
      });
      if (error) {
        return { success: false, status: 'error', error: error.message };
      }
      const { data } = await supabase.auth.getSession();
      logger.info('Email verification completed');
      if (!data.session) {
        return {
          success: true,
          status: 'verified_without_session',
          error: null,
          session: null,
          requiresManualSignIn: true,
        };
      }
      return toSuccess(data.session);
    }

    return { success: false, status: 'error', error: 'Verification link is missing required parameters.' };
  } catch (error) {
    captureError('Verify Email Link', error);
    return { success: false, status: 'error', error: 'Could not verify this email link.' };
  }
}

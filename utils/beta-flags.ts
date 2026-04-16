function envFlag(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw == null || raw === '') return fallback;
  return raw === '1' || raw.toLowerCase() === 'true' || raw.toLowerCase() === 'yes';
}

export const isGoogleSignInDisabled = () =>
  envFlag('EXPO_PUBLIC_DISABLE_GOOGLE_SIGN_IN', false);

export const isCloudSyncDisabled = () =>
  envFlag('EXPO_PUBLIC_DISABLE_CLOUD_SYNC', false);

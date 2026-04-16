import type { ExpoConfig, ConfigContext } from 'expo/config';
import fs from 'node:fs';
import path from 'node:path';

function readEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const output: Record<string, string> = {};
  const raw = fs.readFileSync(filePath, 'utf8');

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    output[key] = value;
  }

  return output;
}

function loadExpoPublicEnv() {
  const projectRoot = __dirname;
  return {
    ...readEnvFile(path.join(projectRoot, '.env')),
    ...readEnvFile(path.join(projectRoot, '.env.local')),
    ...process.env,
  };
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const env = loadExpoPublicEnv();

  return {
    ...config,
    extra: {
      ...config.extra,
      supabaseUrl: env.EXPO_PUBLIC_SUPABASE_URL || config.extra?.supabaseUrl || '',
      supabaseAnonKey: env.EXPO_PUBLIC_SUPABASE_ANON_KEY || config.extra?.supabaseAnonKey || '',
      googleDriveClientId:
        env.EXPO_PUBLIC_GOOGLE_DRIVE_CLIENT_ID || config.extra?.googleDriveClientId || '',
    },
  } as ExpoConfig;
};

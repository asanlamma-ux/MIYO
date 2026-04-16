import { BackupData, ISyncAdapter, SyncAuthResult } from './ISyncAdapter';
import { clearDriveTokens, getValidGoogleDriveAccessToken, revokeDriveTokens, startGoogleDriveOAuth } from '@/lib/google-oauth';
import { isCloudSyncDisabled } from '@/utils/beta-flags';

export class GoogleDriveAdapter implements ISyncAdapter {
  id = 'gdrive';
  name = 'Google Drive';
  icon = 'google-drive';

  private accessToken: string | null = null;
  private static readonly DEFAULT_BACKUP_FILENAME = 'miyo_backup.json';

  private async getAccessToken() {
    if (isCloudSyncDisabled()) {
      return null;
    }
    if (this.accessToken) {
      return this.accessToken;
    }

    const token = await getValidGoogleDriveAccessToken();
    if (token) {
      this.accessToken = token;
    }
    return token;
  }

  async authenticate(): Promise<SyncAuthResult> {
    if (isCloudSyncDisabled()) {
      return {
        success: false,
        status: 'misconfigured',
        message: 'Cloud sync is disabled in this beta build.',
      };
    }
    const result = await startGoogleDriveOAuth();
    if (!result.success) {
      return {
        success: false,
        status: result.status === 'verified_without_session' ? 'reauth_required' : result.status,
        message: result.error,
      };
    }

    const token = await this.getAccessToken();
    if (!token) {
      return {
        success: false,
        status: 'reauth_required',
        message: 'Drive connected, but no usable access token was stored. Reconnect Google Drive.',
      };
    }

    return { success: true, status: 'success' };
  }

  async isAuthenticated(): Promise<boolean> {
    if (isCloudSyncDisabled()) {
      return false;
    }
    const token = await this.getAccessToken();
    return !!token;
  }

  async logout(): Promise<void> {
    this.accessToken = null;
    await revokeDriveTokens();
    await clearDriveTokens();
  }

  private async request<T = unknown>(url: string, init?: RequestInit): Promise<T | null> {
    const token = await this.getAccessToken();
    if (!token) return null;

    const response = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init?.headers || {}),
      },
    });

    if (response.status === 401 || response.status === 403) {
      this.accessToken = null;
      await clearDriveTokens();
      return null;
    }

    if (!response.ok) {
      return null;
    }

    return response.json() as Promise<T>;
  }

  private async getFileId(fileName = GoogleDriveAdapter.DEFAULT_BACKUP_FILENAME): Promise<string | null> {
    const data = await this.request<{ files?: Array<{ id: string }> }>(
      `https://www.googleapis.com/drive/v3/files?spaces=drive&q=${encodeURIComponent(`name="${fileName}" and trashed=false`)}&fields=files(id)`
    );
    return data?.files?.[0]?.id || null;
  }

  async uploadBackup(data: BackupData, fileName = GoogleDriveAdapter.DEFAULT_BACKUP_FILENAME): Promise<boolean> {
    if (isCloudSyncDisabled()) return false;
    const token = await this.getAccessToken();
    if (!token) return false;

    try {
      const fileId = await this.getFileId(fileName);
      const metadata = { name: fileName };
      const boundary = 'miyo_drive_boundary';
      const body =
        `--${boundary}\r\n` +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        `${JSON.stringify(metadata)}\r\n` +
        `--${boundary}\r\n` +
        'Content-Type: application/json\r\n\r\n' +
        `${JSON.stringify(data)}\r\n` +
        `--${boundary}--`;

      const method = fileId ? 'PATCH' : 'POST';
      const url = fileId
        ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`
        : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body,
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  async downloadBackup(fileName = GoogleDriveAdapter.DEFAULT_BACKUP_FILENAME): Promise<BackupData | null> {
    if (isCloudSyncDisabled()) return null;
    const token = await this.getAccessToken();
    if (!token) return null;

    try {
      const fileId = await this.getFileId(fileName);
      if (!fileId) return null;

      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        return null;
      }

      return (await response.json()) as BackupData;
    } catch {
      return null;
    }
  }

  async getLastSyncTime(fileName = GoogleDriveAdapter.DEFAULT_BACKUP_FILENAME): Promise<string | null> {
    if (isCloudSyncDisabled()) return null;
    const fileId = await this.getFileId(fileName);
    if (!fileId) return null;
    const data = await this.request<{ modifiedTime?: string }>(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=modifiedTime`
    );
    return data?.modifiedTime || null;
  }
}

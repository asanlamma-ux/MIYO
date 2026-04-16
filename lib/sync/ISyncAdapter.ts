export interface BackupData {
  timestamp: string;
  keys: Record<string, string>;
  version: string;
}

export interface SyncAuthResult {
  success: boolean;
  status: 'success' | 'cancelled' | 'misconfigured' | 'reauth_required' | 'error';
  message?: string | null;
}

export interface ISyncAdapter {
  id: string; // e.g., 'gdrive', 'webdav'
  name: string; // e.g., 'Google Drive', 'WebDAV'
  icon: string; // e.g., 'folder', 'cloud'
  
  // Authentication
  authenticate: () => Promise<SyncAuthResult>;
  isAuthenticated: () => Promise<boolean>;
  logout: () => Promise<void>;
  
  // Settings (used for WebDAV, FTP, etc where host is required)
  configure?: (config: Record<string, string>) => Promise<void>;
  getConfig?: () => Promise<Record<string, string> | null>;
  
  // Sync Operations
  uploadBackup: (data: BackupData, fileName?: string) => Promise<boolean>;
  downloadBackup: (fileName?: string) => Promise<BackupData | null>;
  getLastSyncTime: (fileName?: string) => Promise<string | null>;
}

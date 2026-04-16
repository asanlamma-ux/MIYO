import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ISyncAdapter, BackupData } from '@/lib/sync/ISyncAdapter';
import { GoogleDriveAdapter } from '@/lib/sync/GoogleDriveAdapter';
import { WebDAVAdapter } from '@/lib/sync/WebDAVAdapter';
import { logger, captureError } from '@/utils/logger';

// List of available adapters
export const SYNC_ADAPTERS: Record<string, ISyncAdapter> = {
  gdrive: new GoogleDriveAdapter(),
  webdav: new WebDAVAdapter(),
};

interface SyncContextType {
  activeAdapterId: string | null;
  setActiveAdapter: (id: string | null) => Promise<void>;
  isSyncing: boolean;
  lastSyncTime: string | null;
  backupData: () => Promise<boolean>;
  restoreData: () => Promise<boolean>;
  getAdapter: (id: string) => ISyncAdapter | undefined;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);
const ACTIVE_ADAPTER_KEY = '@miyo/sync/active_adapter';

export function SyncProvider({ children }: { children: ReactNode }) {
  const [activeAdapterId, setActiveAdapterId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  useEffect(() => {
    loadActiveAdapter();
  }, []);

  const loadActiveAdapter = async () => {
    try {
      const adapterId = await AsyncStorage.getItem(ACTIVE_ADAPTER_KEY);
      if (adapterId && SYNC_ADAPTERS[adapterId]) {
        const isAuthenticated = await SYNC_ADAPTERS[adapterId].isAuthenticated();
        if (isAuthenticated) {
          setActiveAdapterId(adapterId);
          // Load last sync time
          const time = await SYNC_ADAPTERS[adapterId].getLastSyncTime();
          setLastSyncTime(time);
        } else {
          await AsyncStorage.removeItem(ACTIVE_ADAPTER_KEY);
        }
      }
    } catch (e) {
      captureError('Load Active Sync Adapter', e);
    }
  };

  const setActiveAdapter = async (id: string | null) => {
    try {
      if (id) {
        await AsyncStorage.setItem(ACTIVE_ADAPTER_KEY, id);
      } else {
        if (activeAdapterId && SYNC_ADAPTERS[activeAdapterId]) {
          await SYNC_ADAPTERS[activeAdapterId].logout();
        }
        await AsyncStorage.removeItem(ACTIVE_ADAPTER_KEY);
      }
      setActiveAdapterId(id);
    } catch (e) {
      captureError('Set Active Sync Adapter', e);
    }
  };

  const getAdapter = (id: string) => SYNC_ADAPTERS[id];

  const gatherBackupData = async (): Promise<BackupData> => {
    // List of keys to backup
    const keys = [
      '@miyo/library',
      '@miyo/reading-positions',
      '@miyo/bookmarks',
      '@miyo/highlights',
      '@miyo/theme',
      '@miyo/settings',
      '@miyo/typography',
      '@miyo/reading-settings',
      '@miyo/custom-themes',
      '@miyo/last-light-theme',
      '@miyo/last-dark-theme',
      '@miyo/term-groups',
      '@miyo/downloaded-dictionaries',
      '@miyo/opds-catalogs',
      '@miyo/sort',
      '@miyo/filter',
      '@miyo/view-mode',
      '@miyo/reading-stats',
      '@miyo/daily-reading',
      '@miyo/daily-reading-goal-minutes',
    ];

    const entries = await AsyncStorage.multiGet(keys);
    const dataObj: Record<string, string> = {};
    for (const [key, val] of entries) {
      if (val) dataObj[key] = val;
    }

    return {
      timestamp: new Date().toISOString(),
      keys: dataObj,
      version: '1.0.0',
    };
  };

  const applyRestoredData = async (data: BackupData) => {
    const entries: [string, string][] = Object.entries(data.keys);
    await AsyncStorage.multiSet(entries);
  };

  const backupData = async (): Promise<boolean> => {
    if (!activeAdapterId || !SYNC_ADAPTERS[activeAdapterId]) return false;
    try {
      setIsSyncing(true);
      const adapter = SYNC_ADAPTERS[activeAdapterId];
      const data = await gatherBackupData();
      const success = await adapter.uploadBackup(data);
      if (success) {
        setLastSyncTime(data.timestamp);
        logger.info('Backup successful', { adapter: activeAdapterId });
      }
      return success;
    } catch (e) {
      captureError('Backup Data Error', e);
      return false;
    } finally {
      setIsSyncing(false);
    }
  };

  const restoreData = async (): Promise<boolean> => {
    if (!activeAdapterId || !SYNC_ADAPTERS[activeAdapterId]) return false;
    try {
      setIsSyncing(true);
      const adapter = SYNC_ADAPTERS[activeAdapterId];
      const data = await adapter.downloadBackup();
      if (data && data.keys) {
        await applyRestoredData(data);
        logger.info('Restore successful', { adapter: activeAdapterId, version: data.version });
        return true;
      }
      return false;
    } catch (e) {
      captureError('Restore Data Error', e);
      return false;
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <SyncContext.Provider
      value={{
        activeAdapterId,
        setActiveAdapter,
        isSyncing,
        lastSyncTime,
        backupData,
        restoreData,
        getAdapter,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  const context = useContext(SyncContext);
  if (context === undefined) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
}

/**
 * Term Group Google Drive Sync
 * Syncs term groups to/from user's Google Drive
 */

import { GoogleDriveAdapter } from '@/lib/sync/GoogleDriveAdapter';
import { TermGroup } from '@/types/terms';
import { logger, captureError } from '@/utils/logger';

const TERM_GROUP_BACKUP_FILENAME = 'miyo_term_groups_backup.json';

/**
 * Sync term groups to Google Drive
 */
export async function syncTermGroupsToDrive(groups: TermGroup[]): Promise<boolean> {
  try {
    const adapter = new GoogleDriveAdapter();
    const isAuthenticated = await adapter.isAuthenticated();
    if (!isAuthenticated) {
      logger.warn('Cannot sync term groups - not authenticated');
      return false;
    }

    const backupData = {
      magic: 'MIYO_TERM_GROUP_V1',
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      groups,
    };

    const success = await adapter.uploadBackup(
      {
        timestamp: new Date().toISOString(),
        keys: { '@miyo/term-groups': JSON.stringify(backupData) },
        version: '1.0.0',
      },
      TERM_GROUP_BACKUP_FILENAME
    );

    if (success) {
      logger.info('Term groups synced to Google Drive', { count: groups.length });
    }
    return success;
  } catch (error) {
    captureError('Sync Term Groups to Drive', error);
    return false;
  }
}

/**
 * Check Google Drive for existing term group backups
 */
export async function checkDriveForTermGroups(): Promise<{ exists: boolean; groups: TermGroup[] | null }> {
  try {
    const adapter = new GoogleDriveAdapter();
    const isAuthenticated = await adapter.isAuthenticated();
    if (!isAuthenticated) {
      return { exists: false, groups: null };
    }

    const backup = await adapter.downloadBackup(TERM_GROUP_BACKUP_FILENAME);
    if (backup && backup.keys && backup.keys['@miyo/term-groups']) {
      const parsed = JSON.parse(backup.keys['@miyo/term-groups']);
      if (parsed.magic === 'MIYO_TERM_GROUP_V1' && parsed.groups) {
        logger.info('Found term groups on Google Drive', { count: parsed.groups.length });
        return { exists: true, groups: parsed.groups };
      }
    }

    return { exists: false, groups: null };
  } catch (error) {
    captureError('Check Drive for Term Groups', error);
    return { exists: false, groups: null };
  }
}

/**
 * Restore term groups from Google Drive
 */
export async function restoreTermGroupsFromDrive(): Promise<TermGroup[] | null> {
  try {
    const adapter = new GoogleDriveAdapter();
    const isAuthenticated = await adapter.isAuthenticated();
    if (!isAuthenticated) {
      return null;
    }

    const backup = await adapter.downloadBackup(TERM_GROUP_BACKUP_FILENAME);
    if (backup && backup.keys && backup.keys['@miyo/term-groups']) {
      const parsed = JSON.parse(backup.keys['@miyo/term-groups']);
      if (parsed.magic === 'MIYO_TERM_GROUP_V1' && parsed.groups) {
        logger.info('Term groups restored from Google Drive');
        return parsed.groups;
      }
    }

    return null;
  } catch (error) {
    captureError('Restore Term Groups from Drive', error);
    return null;
  }
}

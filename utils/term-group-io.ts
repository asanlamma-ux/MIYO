/**
 * Term Group Export/Import Utility
 * Handles JSON export and import with validation
 */

import * as DocumentPicker from 'expo-document-picker';
import { readAsStringAsync } from 'expo-file-system/legacy';
import { TermGroup } from '@/types/terms';
import { logger, captureError } from '@/utils/logger';

const MIYO_MAGIC = 'MIYO_TERM_GROUP_V1';
const EXPORT_VERSION = '1.0.0';

interface ExportData {
  magic: string;
  version: string;
  exportedAt: string;
  groups: TermGroup[];
}

/**
 * Export selected term groups to a JSON file and open the share sheet.
 * Returns the exported file path on success, null on failure.
 */
export async function exportTermGroups(groups: TermGroup[]): Promise<string | null> {
  return exportSelectedTermGroups(groups);
}

/**
 * Export a specific subset of term groups and open the share sheet.
 * Returns the exported file path on success, null on failure.
 */
export async function exportSelectedTermGroups(groups: TermGroup[]): Promise<string | null> {
  try {
    const Sharing = await import('expo-sharing');
    const FileSystem = await import('expo-file-system/legacy');
    const canShare = await Sharing.isAvailableAsync();

    const exportData: ExportData = {
      magic: MIYO_MAGIC,
      version: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      groups,
    };

    const jsonContent = JSON.stringify(exportData, null, 2);
    const fileName = `miyo_terms_${Date.now()}.json`;
    // Write to cache directory so we can share it
    const exportPath = `${FileSystem.cacheDirectory || ''}${fileName}`;

    await FileSystem.writeAsStringAsync(exportPath, jsonContent, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    logger.info('Term groups exported', { count: groups.length, path: exportPath });

    if (canShare) {
      await Sharing.shareAsync(exportPath, {
        mimeType: 'application/json',
        dialogTitle: 'Save Miyo Term Groups',
        UTI: 'public.json',
      });
    }

    return exportPath;
  } catch (error) {
    captureError('Export Term Groups', error);
    return null;
  }
}

/**
 * Import term groups from a file picker
 */
export async function importTermGroups(): Promise<{ groups: TermGroup[]; error: string | null }> {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/json', 'application/zip', '*/*'],
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return { groups: [], error: null };
    }

    const asset = result.assets[0];
    const content = await readAsStringAsync(asset.uri);
    
    let parsed: ExportData;
    try {
      parsed = JSON.parse(content);
    } catch {
      return { groups: [], error: 'Invalid file format. Please select a valid Miyo term group export file.' };
    }

    // Validate magic string
    if (parsed.magic !== MIYO_MAGIC) {
      return { groups: [], error: 'This file was not created by Miyo. Only Miyo-exported term group files can be imported.' };
    }

    // Validate version
    if (!parsed.version || !parsed.groups || !Array.isArray(parsed.groups)) {
      return { groups: [], error: 'This file appears to be corrupted or from an incompatible version.' };
    }

    // Sanitize and validate each group
    const validGroups: TermGroup[] = [];
    for (const group of parsed.groups) {
      if (!group.id || !group.name || !Array.isArray(group.terms)) {
        continue;
      }
      
      const sanitizedGroup: TermGroup = {
        id: group.id.startsWith('tg_') ? group.id : `tg_import_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: String(group.name).slice(0, 100),
        description: group.description ? String(group.description).slice(0, 500) : undefined,
        terms: (group.terms || []).map((term: any) => ({
          id: term.id || `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          originalText: String(term.originalText || '').slice(0, 200),
          translationText: term.translationText ? String(term.translationText).slice(0, 200) : undefined,
          correctedText: String(term.correctedText || '').slice(0, 200),
          context: term.context ? String(term.context).slice(0, 500) : undefined,
          imageUri: term.imageUri ? String(term.imageUri).slice(0, 1000) : undefined,
          createdAt: term.createdAt || new Date().toISOString(),
          updatedAt: term.updatedAt || term.createdAt || new Date().toISOString(),
        })).filter(t => t.originalText && t.correctedText),
        appliedToBooks: [],
        createdAt: group.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (sanitizedGroup.terms.length > 0) {
        validGroups.push(sanitizedGroup);
      }
    }

    if (validGroups.length === 0) {
      return { groups: [], error: 'No valid term groups found in the file.' };
    }

    logger.info('Term groups imported', { count: validGroups.length });
    return { groups: validGroups, error: null };
  } catch (error) {
    captureError('Import Term Groups', error);
    return { groups: [], error: 'Failed to import term groups. The file may be corrupted.' };
  }
}

/**
 * Get export file info for display
 */
export function getExportInfo(groups: TermGroup[]): string {
  const totalTerms = groups.reduce((sum, g) => sum + g.terms.length, 0);
  return `${groups.length} group${groups.length !== 1 ? 's' : ''}, ${totalTerms} term${totalTerms !== 1 ? 's' : ''}`;
}

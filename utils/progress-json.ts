/**
 * JSON-Based Progress Backup Utility
 * Saves reading progress to a JSON file in the app's document directory.
 * Acts as a secondary backup alongside AsyncStorage.
 */

import {
  documentDirectory,
  writeAsStringAsync,
  readAsStringAsync,
  getInfoAsync,
  EncodingType,
} from 'expo-file-system/legacy';
import { logger, captureError } from './logger';

const PROGRESS_FILE = `${documentDirectory || ''}miyo_progress.json`;

export interface BookProgress {
  bookId: string;
  title: string;
  author: string;
  lastChapter: number;
  percentage: number;
  lastReadAt: string | null;
  savedAt: string;
}

interface ProgressData {
  version: '1';
  updatedAt: string;
  books: Record<string, BookProgress>;
}

let _cachedData: ProgressData | null = null;

async function loadProgressData(): Promise<ProgressData> {
  if (_cachedData) return _cachedData;
  try {
    const info = await getInfoAsync(PROGRESS_FILE);
    if (info.exists) {
      const raw = await readAsStringAsync(PROGRESS_FILE, { encoding: EncodingType.UTF8 });
      const parsed = JSON.parse(raw) as ProgressData;
      _cachedData = parsed;
      return parsed;
    }
  } catch (e) {
    logger.warn('Could not read progress.json', e);
  }
  return { version: '1', updatedAt: new Date().toISOString(), books: {} };
}

async function writeProgressData(data: ProgressData): Promise<void> {
  try {
    _cachedData = data;
    await writeAsStringAsync(PROGRESS_FILE, JSON.stringify(data, null, 2), {
      encoding: EncodingType.UTF8,
    });
  } catch (e) {
    captureError('Write progress.json', e);
  }
}

/**
 * Save reading progress for a single book to progress.json.
 */
export async function saveProgressToJson(progress: BookProgress): Promise<void> {
  try {
    const data = await loadProgressData();
    data.books[progress.bookId] = progress;
    data.updatedAt = new Date().toISOString();
    await writeProgressData(data);
    logger.debug('Progress saved to JSON', { bookId: progress.bookId });
  } catch (e) {
    captureError('Save progress to JSON', e);
  }
}

/**
 * Load all saved book progress from progress.json.
 */
export async function loadAllProgressFromJson(): Promise<BookProgress[]> {
  try {
    const data = await loadProgressData();
    return Object.values(data.books);
  } catch (e) {
    captureError('Load all progress from JSON', e);
    return [];
  }
}

/**
 * Get the path to the progress file (for display purposes).
 */
export function getProgressFilePath(): string {
  return PROGRESS_FILE;
}

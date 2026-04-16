/**
 * Chapter Cache — persists parsed EPUB chapters to the filesystem.
 *
 * First open: parse from ZIP → cache chapters to disk.
 * Subsequent opens: read from cache in < 50 ms.
 *
 * Uses LRU eviction to keep the cache bounded (default: last 25 books).
 */

import * as FileSystem from 'expo-file-system/legacy';
import { logger } from './logger';

const CACHE_ROOT = `${FileSystem.documentDirectory ?? ''}chapter-cache/`;
const MANIFEST_PATH = `${CACHE_ROOT}manifest.json`;
const MAX_CACHED_BOOKS = 25;

interface CacheManifest {
  /** bookId → CacheEntry */
  entries: Record<string, CacheEntry>;
  /** Ordered list of bookIds from least‑recently‑used to most‑recently‑used */
  lru: string[];
}

interface CacheEntry {
  bookId: string;
  /** ISO date of when the cache was written */
  cachedAt: string;
  /** file size in bytes at time of caching – used to detect if book file changed */
  sourceFileSize: number;
  chapterCount: number;
  /** extracted CSS from EPUB stylesheets */
  hasExtractedCss: boolean;
  /** serialised metadata JSON */
  hasMetadata: boolean;
}

interface CachedChapter {
  id: string;
  title: string;
  href: string;
  order: number;
  content: string;
  wordCount?: number;
}

interface CachedBookData {
  metadata: any;
  chapters: CachedChapter[];
  extractedCss: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function ensureCacheDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(CACHE_ROOT);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(CACHE_ROOT, { intermediates: true });
  }
}

async function readManifest(): Promise<CacheManifest> {
  try {
    const raw = await FileSystem.readAsStringAsync(MANIFEST_PATH);
    return JSON.parse(raw) as CacheManifest;
  } catch {
    return { entries: {}, lru: [] };
  }
}

async function writeManifest(manifest: CacheManifest): Promise<void> {
  await ensureCacheDir();
  await FileSystem.writeAsStringAsync(MANIFEST_PATH, JSON.stringify(manifest));
}

function bookDir(bookId: string): string {
  // Sanitize bookId for use as directory name
  const safe = bookId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${CACHE_ROOT}${safe}/`;
}

function chapterPath(bookId: string, index: number): string {
  return `${bookDir(bookId)}ch_${index}.html`;
}

function metadataPath(bookId: string): string {
  return `${bookDir(bookId)}metadata.json`;
}

function cssPath(bookId: string): string {
  return `${bookDir(bookId)}styles.css`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check whether a usable cache exists for a book.
 * Compares the source file size to detect if the EPUB was replaced.
 */
export async function isCacheFresh(bookId: string, filePath: string): Promise<boolean> {
  try {
    const manifest = await readManifest();
    const entry = manifest.entries[bookId];
    if (!entry) return false;

    const fileInfo = await FileSystem.getInfoAsync(filePath);
    if (!fileInfo.exists) return false;
    const fileSize = 'size' in fileInfo ? (fileInfo as any).size : 0;

    // If the file size matches, cache is considered fresh
    if (fileSize > 0 && entry.sourceFileSize > 0 && fileSize !== entry.sourceFileSize) {
      logger.debug('Cache stale: file size changed', { bookId, cached: entry.sourceFileSize, current: fileSize });
      return false;
    }

    // Check if the first chapter file actually exists on disk
    const firstChapter = await FileSystem.getInfoAsync(chapterPath(bookId, 0));
    return firstChapter.exists;
  } catch {
    return false;
  }
}

/**
 * Write parsed chapters to the cache.
 */
export async function cacheBook(
  bookId: string,
  filePath: string,
  data: {
    metadata: any;
    chapters: CachedChapter[];
    extractedCss?: string;
  }
): Promise<void> {
  try {
    const dir = bookDir(bookId);
    const dirInfo = await FileSystem.getInfoAsync(dir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }

    // Write chapters in parallel batches of 5 for speed
    const batchSize = 5;
    for (let i = 0; i < data.chapters.length; i += batchSize) {
      const batch = data.chapters.slice(i, i + batchSize);
      await Promise.all(
        batch.map((ch, j) => {
          const idx = i + j;
          const payload = JSON.stringify({
            id: ch.id,
            title: ch.title,
            href: ch.href,
            order: ch.order,
            content: ch.content,
            wordCount: ch.wordCount,
          });
          return FileSystem.writeAsStringAsync(chapterPath(bookId, idx), payload);
        })
      );
    }

    // Write metadata
    await FileSystem.writeAsStringAsync(metadataPath(bookId), JSON.stringify(data.metadata));

    // Write CSS
    if (data.extractedCss) {
      await FileSystem.writeAsStringAsync(cssPath(bookId), data.extractedCss);
    }

    // Get source file size
    let sourceFileSize = 0;
    try {
      const info = await FileSystem.getInfoAsync(filePath);
      if (info.exists && 'size' in info) {
        sourceFileSize = (info as any).size;
      }
    } catch { /* ignore */ }

    // Update manifest + LRU
    const manifest = await readManifest();
    manifest.entries[bookId] = {
      bookId,
      cachedAt: new Date().toISOString(),
      sourceFileSize,
      chapterCount: data.chapters.length,
      hasExtractedCss: !!data.extractedCss,
      hasMetadata: true,
    };

    // Touch LRU (move to end = most-recently-used)
    manifest.lru = manifest.lru.filter(id => id !== bookId);
    manifest.lru.push(bookId);

    // Evict old entries if over budget
    while (manifest.lru.length > MAX_CACHED_BOOKS) {
      const evictId = manifest.lru.shift()!;
      delete manifest.entries[evictId];
      // Delete directory in background (don't await to avoid slowing caching)
      FileSystem.deleteAsync(bookDir(evictId), { idempotent: true }).catch(() => {});
    }

    await writeManifest(manifest);

    logger.info('Book cached successfully', {
      bookId,
      chapters: data.chapters.length,
      lruSize: manifest.lru.length,
    });
  } catch (error) {
    logger.error('Failed to cache book', error);
  }
}

/**
 * Load a single cached chapter by index.
 */
export async function getCachedChapter(bookId: string, index: number): Promise<CachedChapter | null> {
  try {
    const path = chapterPath(bookId, index);
    const raw = await FileSystem.readAsStringAsync(path);
    return JSON.parse(raw) as CachedChapter;
  } catch {
    return null;
  }
}

/**
 * Load all cached data for a book.
 */
export async function getCachedBook(bookId: string): Promise<CachedBookData | null> {
  try {
    const manifest = await readManifest();
    const entry = manifest.entries[bookId];
    if (!entry) return null;

    // Update LRU access order
    manifest.lru = manifest.lru.filter(id => id !== bookId);
    manifest.lru.push(bookId);
    // Write manifest update in background
    writeManifest(manifest).catch(() => {});

    // Load metadata
    let metadata: any = {};
    try {
      const raw = await FileSystem.readAsStringAsync(metadataPath(bookId));
      metadata = JSON.parse(raw);
    } catch { /* ignore */ }

    // Load CSS
    let extractedCss = '';
    if (entry.hasExtractedCss) {
      try {
        extractedCss = await FileSystem.readAsStringAsync(cssPath(bookId));
      } catch { /* ignore */ }
    }

    // Load all chapters - in parallel batches for speed
    const chapters: CachedChapter[] = [];
    const batchSize = 8;
    for (let i = 0; i < entry.chapterCount; i += batchSize) {
      const end = Math.min(i + batchSize, entry.chapterCount);
      const batch = await Promise.all(
        Array.from({ length: end - i }, (_, j) => getCachedChapter(bookId, i + j))
      );
      for (const ch of batch) {
        if (ch) chapters.push(ch);
      }
    }

    if (chapters.length === 0) return null;

    return { metadata, chapters, extractedCss };
  } catch (error) {
    logger.error('Failed to read cached book', error);
    return null;
  }
}

/**
 * Load a range of chapters (for lazy/batch loading).
 */
export async function getCachedChapterRange(
  bookId: string,
  startIndex: number,
  count: number
): Promise<CachedChapter[]> {
  const results: CachedChapter[] = [];
  const loadPromises = Array.from({ length: count }, (_, i) =>
    getCachedChapter(bookId, startIndex + i)
  );
  const loaded = await Promise.all(loadPromises);
  for (const ch of loaded) {
    if (ch) results.push(ch);
  }
  return results;
}

/**
 * Invalidate cache for a specific book.
 */
export async function invalidateCache(bookId: string): Promise<void> {
  try {
    const manifest = await readManifest();
    delete manifest.entries[bookId];
    manifest.lru = manifest.lru.filter(id => id !== bookId);
    await writeManifest(manifest);
    await FileSystem.deleteAsync(bookDir(bookId), { idempotent: true });
    logger.debug('Cache invalidated', { bookId });
  } catch (error) {
    logger.error('Failed to invalidate cache', error);
  }
}

/**
 * Clear the entire chapter cache.
 */
export async function clearAllCache(): Promise<void> {
  try {
    await FileSystem.deleteAsync(CACHE_ROOT, { idempotent: true });
    logger.info('All chapter cache cleared');
  } catch (error) {
    logger.error('Failed to clear chapter cache', error);
  }
}

/**
 * Get approximate cache size in bytes.
 */
export async function getCacheSize(): Promise<number> {
  try {
    const manifest = await readManifest();
    let total = 0;
    for (const bookId of Object.keys(manifest.entries)) {
      const dir = bookDir(bookId);
      try {
        const info = await FileSystem.getInfoAsync(dir);
        if (info.exists && 'size' in info) {
          total += (info as any).size;
        }
      } catch { /* skip */ }
    }
    return total;
  } catch {
    return 0;
  }
}

import * as Crypto from 'expo-crypto';
import { EncodingType, readAsStringAsync } from 'expo-file-system/legacy';
import { Book } from '@/types/book';
import { EpubMetadata, parseEpubLightweight } from '@/utils/epub-parser';

export type DuplicateMatchType = 'exact' | 'probable' | 'path';

export interface PreparedBookImport {
  metadata: EpubMetadata;
  chapterCount: number;
  contentHash: string;
  identityKey: string;
  fallbackTitle: string;
}

export interface DuplicateMatch {
  type: DuplicateMatchType;
  existing: Book;
}

export interface DuplicateAuditSummary {
  exactGroups: Array<{ key: string; books: Book[] }>;
  probableGroups: Array<{ key: string; books: Book[] }>;
}

export function fileBasename(path: string): string {
  const parts = path.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || '';
}

export function normalizePath(path: string): string {
  return path.trim().toLowerCase();
}

export function makeUniqueLabel(base: string, used: Set<string>): string {
  const normalizedBase = base.trim() || 'Untitled';
  if (!used.has(normalizedBase.toLowerCase())) {
    return normalizedBase;
  }

  let index = 1;
  let candidate = `${normalizedBase} (${index})`;
  while (used.has(candidate.toLowerCase())) {
    index += 1;
    candidate = `${normalizedBase} (${index})`;
  }
  return candidate;
}

export function inferStorageLocation(filePath: string): 'app' | 'saf' {
  return filePath.startsWith('content://') ? 'saf' : 'app';
}

function normalizeText(value: string | null | undefined): string {
  return (value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizeIdentifier(value: string | null | undefined): string | null {
  const normalized = (value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/^urn:/, '')
    .replace(/^uuid:/, '')
    .replace(/^isbn:/, '')
    .replace(/\s+/g, '')
    .trim();

  if (!normalized || normalized === 'unknown') {
    return null;
  }

  return normalized.length >= 4 ? normalized : null;
}

export function buildIdentityKey(
  metadata: Pick<EpubMetadata, 'title' | 'author' | 'language' | 'identifier'>,
  chapterCount: number
): string {
  const identifier = normalizeIdentifier(metadata.identifier);
  if (identifier) {
    return `epub:${identifier}`;
  }

  const title = normalizeText(metadata.title) || 'unknown-title';
  const author = normalizeText(metadata.author) || 'unknown-author';
  const language = normalizeText(metadata.language) || 'unknown-language';
  const safeChapterCount = Number.isFinite(chapterCount) && chapterCount > 0 ? chapterCount : 1;
  return `meta:${title}|${author}|${language}|${safeChapterCount}`;
}

export function enrichStoredBook(book: Book): Book {
  const normalizedFileName = book.fileName || fileBasename(book.filePath);
  return {
    ...book,
    fileName: normalizedFileName,
    epubIdentifier: book.epubIdentifier ?? null,
    identityKey:
      book.identityKey ||
      buildIdentityKey(
        {
          title: book.title,
          author: book.author,
          language: book.language || 'en',
          identifier: book.epubIdentifier ?? null,
        },
        book.totalChapters
      ),
    language: book.language || 'en',
    storageLocation: book.storageLocation || inferStorageLocation(book.filePath),
    storageFolderUri: book.storageFolderUri ?? null,
  };
}

function groupBooksBy<T extends string>(items: Array<{ key: T | null; book: Book }>): Map<T, Book[]> {
  const grouped = new Map<T, Book[]>();
  for (const item of items) {
    if (!item.key) continue;
    const existing = grouped.get(item.key);
    if (existing) {
      existing.push(item.book);
    } else {
      grouped.set(item.key, [item.book]);
    }
  }
  return grouped;
}

export function buildBookIdentityIndex(sourceBooks: Book[]) {
  const books = sourceBooks.map(enrichStoredBook);
  const byPath = groupBooksBy(books.map(book => ({ key: normalizePath(book.filePath), book })));
  const byHash = groupBooksBy(books.map(book => ({ key: book.contentHash || null, book })));
  const byIdentity = groupBooksBy(books.map(book => ({ key: book.identityKey || null, book })));

  return {
    books,
    byPath,
    byHash,
    byIdentity,
  };
}

export async function prepareBookImport(filePath: string, fallbackFileName: string): Promise<PreparedBookImport> {
  const fallbackTitle = fallbackFileName.replace(/\.epub$/i, '').replace(/[_-]/g, ' ').trim() || 'Untitled Book';
  const [base64, lightweight] = await Promise.all([
    readAsStringAsync(filePath, { encoding: EncodingType.Base64 }),
    parseEpubLightweight(filePath).catch(() => null),
  ]);

  const contentHash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, base64);

  const metadata: EpubMetadata = lightweight?.metadata || {
    title: fallbackTitle,
    author: 'Unknown Author',
    description: '',
    language: 'en',
    publisher: '',
    identifier: null,
    coverImageBase64: null,
    subjects: [],
    publishDate: '',
  };

  const chapterCount = Math.max(lightweight?.totalChapters || 1, 1);

  return {
    metadata,
    chapterCount,
    contentHash,
    identityKey: buildIdentityKey(metadata, chapterCount),
    fallbackTitle,
  };
}

export function findDuplicateBook(
  candidate: Pick<PreparedBookImport, 'contentHash' | 'identityKey'> & { filePath: string },
  sourceBooks: Book[]
): DuplicateMatch | null {
  const { byPath, byHash, byIdentity } = buildBookIdentityIndex(sourceBooks);
  const normalizedPath = normalizePath(candidate.filePath);

  const pathMatches = byPath.get(normalizedPath);
  if (pathMatches?.length) {
    return { type: 'path', existing: pathMatches[0] };
  }

  const exactMatches = byHash.get(candidate.contentHash);
  if (exactMatches?.length) {
    return { type: 'exact', existing: exactMatches[0] };
  }

  const probableMatches = byIdentity.get(candidate.identityKey);
  if (probableMatches?.length) {
    return { type: 'probable', existing: probableMatches[0] };
  }

  return null;
}

export function createImportedBook(params: {
  id: string;
  filePath: string;
  fileName: string;
  prepared: PreparedBookImport;
  dateAdded?: string;
  storageFolderUri?: string | null;
  titleOverride?: string;
}): Book {
  const {
    id,
    filePath,
    fileName,
    prepared,
    dateAdded,
    storageFolderUri = null,
    titleOverride,
  } = params;
  return {
    id,
    title: titleOverride || prepared.metadata.title || prepared.fallbackTitle,
    author: prepared.metadata.author || 'Unknown Author',
    coverUri: prepared.metadata.coverImageBase64 || null,
    filePath,
    fileName,
    contentHash: prepared.contentHash,
    identityKey: prepared.identityKey,
    epubIdentifier: prepared.metadata.identifier || null,
    language: prepared.metadata.language || 'en',
    storageLocation: inferStorageLocation(filePath),
    storageFolderUri,
    progress: 0,
    currentChapter: 0,
    totalChapters: prepared.chapterCount,
    lastReadAt: null,
    dateAdded: dateAdded || new Date().toISOString(),
    readingStatus: 'unread',
    tags: prepared.metadata.subjects?.slice(0, 3) || [],
  };
}

export function auditLibraryDuplicates(sourceBooks: Book[]): DuplicateAuditSummary {
  const { books, byHash, byIdentity } = buildBookIdentityIndex(sourceBooks);
  const exactGroups = Array.from(byHash.entries())
    .filter(([, group]) => group.length > 1)
    .map(([key, group]) => ({ key, books: group }));

  const exactBookIds = new Set(exactGroups.flatMap(group => group.books.map(book => book.id)));
  const probableGroups = Array.from(byIdentity.entries())
    .filter(([, group]) => group.length > 1)
    .map(([key, group]) => ({
      key,
      books: group.filter(book => !exactBookIds.has(book.id) || group.length === 1),
    }))
    .filter(group => group.books.length > 1);

  if (!books.length) {
    return { exactGroups: [], probableGroups: [] };
  }

  return {
    exactGroups,
    probableGroups,
  };
}

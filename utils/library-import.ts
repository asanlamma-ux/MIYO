import {
  copyAsync,
  documentDirectory,
  EncodingType,
  getInfoAsync,
  makeDirectoryAsync,
  readAsStringAsync,
  StorageAccessFramework,
  writeAsStringAsync,
} from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { Book } from '@/types/book';
import { logger } from '@/utils/logger';
import {
  createImportedBook,
  fileBasename,
  findDuplicateBook,
  makeUniqueLabel,
  PreparedBookImport,
  prepareBookImport,
} from '@/utils/book-identity';

export type ImportOutcome =
  | { status: 'imported'; book: Book }
  | {
      status: 'duplicate';
      duplicateType: 'exact' | 'probable' | 'path';
      existingBook: Book;
      prepared: PreparedBookImport;
    }
  | { status: 'failed'; error: Error };

function ensureEpubExtension(fileName: string): string {
  return /\.epub$/i.test(fileName) ? fileName : `${fileName}.epub`;
}

export function sanitizeImportFileName(fileName: string, fallbackPrefix = 'book'): string {
  const cleaned = (fileName || `${fallbackPrefix}_${Date.now()}.epub`).replace(/[<>:"/\\|?*]/g, '_').trim();
  return ensureEpubExtension(cleaned || `${fallbackPrefix}_${Date.now()}.epub`);
}

export function makeUniqueFilename(base: string, used: Set<string>): string {
  let name = base;
  if (!used.has(name.toLowerCase())) return name;
  const lastDot = base.lastIndexOf('.');
  const stem = lastDot > 0 ? base.slice(0, lastDot) : base;
  const ext = lastDot > 0 ? base.slice(lastDot) : '';
  let n = 1;
  do {
    name = `${stem} (${n})${ext}`;
    n++;
  } while (used.has(name.toLowerCase()));
  return name;
}

async function ensureAppBooksDir(): Promise<string> {
  const booksDir = `${documentDirectory || ''}Books/`;
  const dirInfo = await getInfoAsync(booksDir);
  if (!dirInfo.exists) {
    await makeDirectoryAsync(booksDir, { intermediates: true });
  }
  return booksDir;
}

async function persistImportedFile(sourceUri: string, safeFileName: string, storageDirUri: string | null): Promise<string> {
  const sanitizedName = sanitizeImportFileName(safeFileName);

  if (storageDirUri && Platform.OS === 'android') {
    try {
      const destPath = await StorageAccessFramework.createFileAsync(
        storageDirUri,
        sanitizedName,
        'application/epub+zip'
      );
      const contentBase64 = await readAsStringAsync(sourceUri, { encoding: EncodingType.Base64 });
      await writeAsStringAsync(destPath, contentBase64, { encoding: EncodingType.Base64 });
      return destPath;
    } catch (error) {
      logger.error('SAF write failed, falling back to app storage', error);
    }
  }

  const booksDir = await ensureAppBooksDir();
  const destPath = `${booksDir}${sanitizedName}`;
  await copyAsync({ from: sourceUri, to: destPath });
  return destPath;
}

export async function importBookFromSource(params: {
  sourceUri: string;
  sourceFileName: string;
  existingBooks: Book[];
  storageDirUri: string | null;
  addBook: (book: Book) => Promise<void>;
  prepared?: PreparedBookImport;
  usedNames?: Set<string>;
  skipDuplicateCheck?: boolean;
  titleOverride?: string;
}): Promise<ImportOutcome> {
  const safeOriginalName = sanitizeImportFileName(params.sourceFileName);

  try {
    const prepared = params.prepared || (await prepareBookImport(params.sourceUri, safeOriginalName));
    if (!params.skipDuplicateCheck) {
      const duplicate = findDuplicateBook(
        {
          filePath: params.sourceUri,
          contentHash: prepared.contentHash,
          identityKey: prepared.identityKey,
        },
        params.existingBooks
      );

      if (duplicate) {
        return {
          status: 'duplicate',
          duplicateType: duplicate.type,
          existingBook: duplicate.existing,
          prepared,
        };
      }
    }

    const usedNames = params.usedNames || new Set(params.existingBooks.map(book => fileBasename(book.filePath).toLowerCase()));
    const uniqueFileName = makeUniqueFilename(safeOriginalName, usedNames);
    const usedTitles = new Set(params.existingBooks.map(book => book.title.toLowerCase()));
    const resolvedTitle =
      params.titleOverride ||
      (params.skipDuplicateCheck
        ? makeUniqueLabel(prepared.metadata.title || prepared.fallbackTitle, usedTitles)
        : undefined);
    const destPath = await persistImportedFile(params.sourceUri, uniqueFileName, params.storageDirUri);
    const importedBook = createImportedBook({
      id: `book_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
      filePath: destPath,
      fileName: uniqueFileName,
      prepared,
      storageFolderUri: destPath.startsWith('content://') ? params.storageDirUri : null,
      titleOverride: resolvedTitle,
    });

    await params.addBook(importedBook);
    usedNames.add(uniqueFileName.toLowerCase());
    return { status: 'imported', book: importedBook };
  } catch (error) {
    return {
      status: 'failed',
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}
